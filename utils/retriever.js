import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf"
import { createClient } from "@supabase/supabase-js"

// Support both browser (import.meta.env) and server (process.env) environments.
const env =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : process.env

const hfKey = env.VITE_HUGGINGFACE_API_KEY || env.HUGGINGFACE_API_KEY
const sbApiKey =
  env.VITE_SUPABASE_API_KEY_GLAS || env.SUPABASE_API_KEY_GLAS
const sbUrl = env.VITE_SUPABASE_URL_GLAS || env.SUPABASE_URL_GLAS

// Embeddings model (must match ingest script)
const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: hfKey,
  model: "sentence-transformers/all-MiniLM-L6-v2"
})

// Supabase credentials
const client = createClient(sbUrl, sbApiKey)

// Vector store
const vectorStore = new SupabaseVectorStore(embeddings, {
  client,
  tableName: "documents",
  queryName: "match_documents"
})

// Retriever
const retriever = vectorStore.asRetriever({
  k: 8
})

export { retriever }
