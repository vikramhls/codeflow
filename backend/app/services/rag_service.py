import os
import asyncio
import chromadb
from chromadb.config import Settings
from app.models.file import RepoFile
from app.config import settings
from app.services.file_service import get_file_content

# Initialize ChromaDB
CHROMA_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "chroma_db")
os.makedirs(CHROMA_DB_DIR, exist_ok=True)

try:
    chroma_client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
except Exception as e:
    print(f"Warning: Could not initialize ChromaDB: {e}")
    chroma_client = None

def get_collection_name(repo_id: str) -> str:
    # Collection names must be lowercase, alphanumeric, and 3-63 characters
    return f"repo-{repo_id.lower().replace('-', '')}"

async def index_repository(repo_id: str):
    """Chunk and embed all files in a repository."""
    if not chroma_client:
        print("ChromaDB not initialized. Skipping indexing.")
        return

    collection_name = get_collection_name(repo_id)
    
    # Get or create the collection. We delete first to do a fresh index
    try:
        chroma_client.delete_collection(name=collection_name)
    except Exception:
        pass
        
    collection = chroma_client.create_collection(name=collection_name)

    # Fetch all parsed files for this repo
    files = await RepoFile.find(RepoFile.repo_id == repo_id).to_list()
    
    documents = []
    metadatas = []
    ids = []
    
    semaphore = asyncio.Semaphore(15)
    
    async def process_file(f):
        async with semaphore:
            content = await get_file_content(f)
            if not content:
                return [], [], []
                
            # Simple chunking by line, roughly 500 characters
            lines = content.split("\n")
            chunk = ""
            chunk_idx = 0
            
            f_docs, f_metas, f_ids = [], [], []
            
            for line in lines:
                chunk += line + "\n"
                if len(chunk) > 500:
                    f_docs.append(chunk)
                    f_metas.append({"path": f.path, "filename": f.filename})
                    f_ids.append(f"{str(f.id)}_chunk_{chunk_idx}")
                    chunk = ""
                    chunk_idx += 1
                    
            if chunk:
                f_docs.append(chunk)
                f_metas.append({"path": f.path, "filename": f.filename})
                f_ids.append(f"{str(f.id)}_chunk_{chunk_idx}")
                
            return f_docs, f_metas, f_ids

    # Fetch and process all files concurrently
    tasks = [process_file(f) for f in files]
    results = await asyncio.gather(*tasks)
    
    for f_docs, f_metas, f_ids in results:
        if f_docs:
            documents.extend(f_docs)
            metadatas.extend(f_metas)
            ids.extend(f_ids)

    if documents:
        # ChromaDB uses a built-in SentenceTransformers model to embed automatically!
        # This batches the embeddings
        batch_size = 100
        for i in range(0, len(documents), batch_size):
            collection.add(
                documents=documents[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size],
                ids=ids[i:i+batch_size]
            )

async def search_codebase(repo_id: str, query: str, top_k: int = 5) -> list:
    """Search the codebase using the query."""
    if not chroma_client:
        return []

    collection_name = get_collection_name(repo_id)
    try:
        collection = chroma_client.get_collection(name=collection_name)
    except Exception:
        return [] # Collection doesn't exist

    results = collection.query(
        query_texts=[query],
        n_results=top_k
    )

    snippets = []
    if results and results.get("documents") and results["documents"][0]:
        docs = results["documents"][0]
        metas = results["metadatas"][0]
        
        for doc, meta in zip(docs, metas):
            snippets.append({
                "path": meta.get("path", "unknown"),
                "content": doc
            })
            
    return snippets
