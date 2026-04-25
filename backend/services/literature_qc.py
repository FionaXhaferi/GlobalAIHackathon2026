import asyncio
import httpx
import json
import os
import re
import xml.etree.ElementTree as ET
import anthropic
from dotenv import load_dotenv

load_dotenv()

# ── Tavily search ─────────────────────────────────────────────────────────────

async def _search_tavily(query: str) -> list[dict]:
    """
    Search via Tavily API — covers protocols.io, Bio-Protocol, Nature Protocols,
    PubMed web, bioRxiv, and general scientific web that other APIs miss.
    Runs two targeted queries in parallel:
      1. general scientific literature search
      2. protocol-repository focused search
    """
    api_key = os.getenv("TAVILY_API_KEY", "")
    if not api_key or api_key == "your-tavily-key-here":
        return []

    payload_science = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "max_results": 5,
        "include_domains": [
            "pubmed.ncbi.nlm.nih.gov",
            "ncbi.nlm.nih.gov",
            "nature.com",
            "science.org",
            "cell.com",
            "biorxiv.org",
            "medrxiv.org",
            "plos.org",
            "frontiersin.org",
            "mdpi.com",
        ],
    }
    payload_protocols = {
        "api_key": api_key,
        "query": f"{query} protocol method",
        "search_depth": "advanced",
        "max_results": 4,
        "include_domains": [
            "protocols.io",
            "bio-protocol.org",
            "jove.com",
            "openwetware.org",
            "addgene.org",
            "atcc.org",
        ],
    }

    results = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r1, r2 = await asyncio.gather(
                client.post("https://api.tavily.com/search", json=payload_science),
                client.post("https://api.tavily.com/search", json=payload_protocols),
                return_exceptions=True,
            )
            for resp in (r1, r2):
                if isinstance(resp, Exception):
                    continue
                try:
                    resp.raise_for_status()
                    for item in resp.json().get("results", []):
                        title = item.get("title", "")
                        url = item.get("url", "")
                        snippet = (item.get("content") or item.get("snippet") or "")[:300]
                        if title or url:
                            results.append({
                                "source": "Tavily",
                                "title": title,
                                "authors": [],
                                "year": None,
                                "abstract": snippet,
                                "url": url,
                            })
                except Exception:
                    continue
    except Exception:
        pass

    # Deduplicate by URL
    seen = set()
    deduped = []
    for r in results:
        if r["url"] not in seen:
            seen.add(r["url"])
            deduped.append(r)
    return deduped

# ── Search query extraction ───────────────────────────────────────────────────

def _make_search_query(hypothesis: str) -> str:
    """
    Strip prediction language from hypothesis and return a keyword-focused
    search query. The full hypothesis sentence is a bad search query because
    database engines choke on long conditional statements.

    e.g. "Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks
    will reduce intestinal permeability by at least 30%..."
    → "C57BL/6 mice Lactobacillus rhamnosus GG intestinal permeability tight junction"
    """
    text = hypothesis.strip()

    # Split before "will <action-verb>" — the subject contains the key entities
    split = re.split(
        r'\s+will\s+(?:increase|decrease|reduce|improve|enhance|inhibit|detect|show|'
        r'demonstrate|produce|generate|convert|prevent|promote|activate|suppress|'
        r'outperform|match|exceed|enable|cause|lead|result|fix|replace|boost)',
        text, maxsplit=1, flags=re.IGNORECASE
    )
    query = split[0].strip()

    # Append key terms from the predicate (assay names, model organisms, specific proteins)
    if len(split) > 1:
        predicate = split[1]
        # Pull out capitalised terms and hyphenated compound words (likely proper nouns / assay names)
        extra = re.findall(r'\b[A-Z][a-zA-Z0-9-]{3,}\b', predicate)
        if extra:
            query += " " + " ".join(extra[:6])

    # Strip pure quantitative claims that pollute search ("at least 30%", "below 0.5 mg/L")
    query = re.sub(r'\bat\s+least\s+[\d.]+\s*[\w%/]+', '', query, flags=re.IGNORECASE)
    query = re.sub(r'\bbelow\s+[\d.]+\s*[\w%/]+', '', query, flags=re.IGNORECASE)
    query = re.sub(r'\bwithin\s+\d+\s+\w+', '', query, flags=re.IGNORECASE)

    query = " ".join(query.split())  # collapse whitespace
    # Fall back to first 150 chars if extraction was too aggressive
    return query[:200] if len(query) >= 20 else hypothesis[:150]


SEMANTIC_SCHOLAR_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
SS_FIELDS = "title,authors,year,abstract,url,externalIds"

PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

ARXIV_URL = "https://export.arxiv.org/api/query"


# ── Source: Semantic Scholar ─────────────────────────────────────────────────

async def _search_semantic_scholar(query: str, client: httpx.AsyncClient, limit: int = 6) -> list[dict]:
    try:
        resp = await client.get(
            SEMANTIC_SCHOLAR_URL,
            params={"query": query, "limit": limit, "fields": SS_FIELDS},
            headers={"User-Agent": "AI-Scientist-Tool/1.0"},
        )
        resp.raise_for_status()
        papers = resp.json().get("data", [])
        results = []
        for p in papers:
            url = p.get("url") or ""
            if not url and p.get("externalIds", {}).get("DOI"):
                url = f"https://doi.org/{p['externalIds']['DOI']}"
            results.append({
                "source": "Semantic Scholar",
                "title": p.get("title", ""),
                "authors": [a.get("name", "") for a in (p.get("authors") or [])[:3]],
                "year": p.get("year"),
                "abstract": (p.get("abstract") or "")[:300],
                "url": url,
            })
        return results
    except Exception:
        return []


# ── Source: PubMed (NCBI E-utilities) ────────────────────────────────────────

async def _search_pubmed(query: str, client: httpx.AsyncClient, limit: int = 6) -> list[dict]:
    try:
        search_resp = await client.get(
            PUBMED_SEARCH_URL,
            params={"db": "pubmed", "term": query, "retmax": limit, "retmode": "json"},
            headers={"User-Agent": "AI-Scientist-Tool/1.0"},
        )
        search_resp.raise_for_status()
        ids = search_resp.json().get("esearchresult", {}).get("idlist", [])
        if not ids:
            return []

        summary_resp = await client.get(
            PUBMED_SUMMARY_URL,
            params={"db": "pubmed", "id": ",".join(ids), "retmode": "json"},
            headers={"User-Agent": "AI-Scientist-Tool/1.0"},
        )
        summary_resp.raise_for_status()
        uids = summary_resp.json().get("result", {})

        results = []
        for uid in ids:
            p = uids.get(uid, {})
            if not p or uid == "uids":
                continue
            authors = [a.get("name", "") for a in (p.get("authors") or [])[:3]]
            pub_date = p.get("pubdate", "")
            year = int(pub_date[:4]) if pub_date and pub_date[:4].isdigit() else None
            pmid = p.get("uid", uid)
            results.append({
                "source": "PubMed",
                "title": p.get("title", ""),
                "authors": authors,
                "year": year,
                "abstract": "",
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
            })
        return results
    except Exception:
        return []


# ── Source: arXiv ─────────────────────────────────────────────────────────────

async def _search_arxiv(query: str, client: httpx.AsyncClient, limit: int = 4) -> list[dict]:
    try:
        resp = await client.get(
            ARXIV_URL,
            params={"search_query": f"all:{query}", "max_results": limit, "sortBy": "relevance"},
            headers={"User-Agent": "AI-Scientist-Tool/1.0"},
            timeout=12.0,
        )
        resp.raise_for_status()
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        root = ET.fromstring(resp.text)
        results = []
        for entry in root.findall("atom:entry", ns):
            title_el = entry.find("atom:title", ns)
            summary_el = entry.find("atom:summary", ns)
            published_el = entry.find("atom:published", ns)
            link_el = entry.find("atom:id", ns)
            authors = [
                a.find("atom:name", ns).text or ""
                for a in entry.findall("atom:author", ns)[:3]
                if a.find("atom:name", ns) is not None
            ]
            year = None
            if published_el is not None and published_el.text:
                try:
                    year = int(published_el.text[:4])
                except ValueError:
                    pass
            abstract = (summary_el.text or "")[:300] if summary_el is not None else ""
            url = link_el.text.strip() if link_el is not None and link_el.text else ""
            results.append({
                "source": "arXiv",
                "title": (title_el.text or "").strip() if title_el is not None else "",
                "authors": authors,
                "year": year,
                "abstract": abstract,
                "url": url,
            })
        return results
    except Exception:
        return []


# ── Merge and format ──────────────────────────────────────────────────────────

def _format_results(all_papers: list[dict]) -> str:
    if not all_papers:
        return "No papers found across any searched database."
    lines = []
    for i, p in enumerate(all_papers, 1):
        author_str = ", ".join(p["authors"])
        if len(p["authors"]) == 3:
            author_str += " et al."
        abstract_str = f"\n   Abstract: {p['abstract']}..." if p["abstract"] else ""
        lines.append(
            f"{i}. [{p['source']}] {p.get('title', 'N/A')}\n"
            f"   Authors: {author_str or 'N/A'} | Year: {p.get('year', 'N/A')}\n"
            f"   URL: {p.get('url', 'N/A')}"
            f"{abstract_str}"
        )
    return "\n\n".join(lines)


# ── JSON extraction ───────────────────────────────────────────────────────────

def _extract_json(text: str) -> dict:
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    raise ValueError("Could not extract JSON from literature QC response")


# ── Main entry point ──────────────────────────────────────────────────────────

async def check_literature(question: str) -> dict:
    search_query = _make_search_query(question)
    async with httpx.AsyncClient(timeout=15.0) as client:
        ss_results, pubmed_results, arxiv_results, tavily_results = await asyncio.gather(
            _search_semantic_scholar(search_query, client),
            _search_pubmed(search_query, client),
            _search_arxiv(search_query, client),
            _search_tavily(search_query),
        )

    all_papers = ss_results + pubmed_results + arxiv_results + tavily_results
    formatted = _format_results(all_papers)

    sources_used = []
    if ss_results:      sources_used.append(f"Semantic Scholar ({len(ss_results)} results)")
    if pubmed_results:  sources_used.append(f"PubMed ({len(pubmed_results)} results)")
    if arxiv_results:   sources_used.append(f"arXiv ({len(arxiv_results)} results)")
    if tavily_results:  sources_used.append(f"Tavily Web ({len(tavily_results)} results)")
    sources_str = ", ".join(sources_used) if sources_used else "no databases returned results"

    anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    prompt = f"""You are a scientific literature expert with deep knowledge of published research across biology, chemistry, materials science, and engineering up to early 2025.

A researcher has submitted this hypothesis:
"{question}"

YOUR PRIMARY TASK — use your own scientific knowledge:
Before looking at any search results below, ask yourself: does this research area have published literature? Is the core intervention/mechanism something that has been studied before?

You know the literature. For example:
- Paper-based electrochemical biosensors for CRP detection → extensively published field
- Lactobacillus rhamnosus GG and gut permeability/tight junctions in mice → well-studied
- Trehalose vs sucrose as cryoprotectant for cell lines → established area
- Sporomusa ovata electrochemical CO2 reduction to acetate → published since ~2010

CLASSIFICATION — choose based on YOUR KNOWLEDGE, use search results only as supporting evidence:

"exact_match": This specific type of experiment has been published. The core method + organism/model + measured outcome are all present in the literature. The researcher would be replicating known work.

"similar_exists": Related work exists but the specific combination of conditions is not fully established. The experiment would add new data to an existing research area.

"not_found": Genuinely novel. The specific mechanism or intervention has not been studied in any published form you are aware of.

SUPPLEMENTARY search results from Semantic Scholar, PubMed, arXiv ({sources_str}):
{formatted}

Use these results to identify 1–3 specific real papers to cite as references. If the search results are unhelpful, use your own knowledge to name real papers you know exist (include real authors and years).

Return ONLY valid JSON (no preamble, no markdown fences):
{{
  "novelty_signal": "not_found" | "similar_exists" | "exact_match",
  "sources_searched": {json.dumps(sources_used)},
  "references": [
    {{
      "title": "full paper title",
      "authors": ["Author One", "Author Two"],
      "year": 2023,
      "url": "https://doi.org/... or https://pubmed.ncbi.nlm.nih.gov/...",
      "relevance_reason": "one sentence explaining relevance to this hypothesis"
    }}
  ],
  "summary": "2-3 sentence summary: what has been published in this area, and what specific gap (if any) this hypothesis addresses"
}}"""

    try:
        message = anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=(
                "You are a scientific literature expert. Your knowledge of published research "
                "is your primary tool for novelty classification. Database search results are "
                "supplementary — trust your own knowledge when they are unhelpful or incomplete."
            ),
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception as exc:
        msg = str(exc)
        if "credit balance is too low" in msg or "billing" in msg.lower():
            raise RuntimeError(
                "Your Anthropic API account has no credits. "
                "Add credits at console.anthropic.com/settings/billing then try again."
            ) from exc
        raise

    raw = message.content[0].text
    try:
        result = _extract_json(raw)
        if "novelty_signal" not in result:
            result["novelty_signal"] = "similar_exists"
        if "references" not in result:
            result["references"] = []
        if "summary" not in result:
            result["summary"] = "Literature analysis completed."
        return result
    except Exception:
        return {
            "novelty_signal": "similar_exists",
            "references": [],
            "summary": "Literature check completed. Unable to parse structured results.",
        }
