import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf"
import { createClient } from "@supabase/supabase-js"

// Embeddings model (must match ingest script)
const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: import.meta.env.VITE_HUGGINGFACE_API_KEY,
  model: "sentence-transformers/all-MiniLM-L6-v2"
})

// Supabase credentials
const sbApiKey = import.meta.env.VITE_SUPABASE_API_KEY_GLAS
const sbUrl = import.meta.env.VITE_SUPABASE_URL_GLAS

const client = createClient(sbUrl, sbApiKey)

// Vector store
const vectorStore = new SupabaseVectorStore(embeddings, {
  client,
  tableName: "documents",
  queryName: "match_documents"
})

// Retriever
const retriever = vectorStore.asRetriever(4)

export { retriever }