import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase"
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf"
import { createClient } from "@supabase/supabase-js"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---- Config -------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "..", "data") // put your Brauhaus texts here (.txt / .md)
const CHUNK_SIZE = 800   // chars per chunk
const CHUNK_OVERLAP = 120

// ---- Env checks ---------------------------------------------------------
const requiredEnv = [
  "VITE_HUGGINGFACE_API_KEY",
  "VITE_SUPABASE_URL_GLAS",
  "VITE_SUPABASE_API_KEY_GLAS"
]
const missing = requiredEnv.filter((k) => !process.env[k])
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "))
  process.exit(1)
}

// ---- Read source files --------------------------------------------------
function loadRawTexts() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data folder not found: ${DATA_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.match(/\.(txt|md)$/i))
  if (!files.length) {
    console.error(`No .txt or .md files in ${DATA_DIR}. Add your Brauhaus content and rerun.`)
    process.exit(1)
  }

  return files.map((filename) => {
    const full = path.join(DATA_DIR, filename)
    const content = fs.readFileSync(full, "utf8")
    return { filename, content }
  })
}

// ---- Split into chunks --------------------------------------------------
async function buildDocuments() {
  const raw = loadRawTexts()
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP
  })

  const docs = []
  for (const file of raw) {
    const chunks = await splitter.createDocuments(
      [file.content],
      [{ source: file.filename }]
    )
    docs.push(...chunks)
  }
  return docs
}

// ---- Run ingest ---------------------------------------------------------
async function main() {
  const embeddings = new HuggingFaceInferenceEmbeddings({
    apiKey: process.env.VITE_HUGGINGFACE_API_KEY,
    model: "sentence-transformers/all-MiniLM-L6-v2"
  })

  const client = createClient(
  process.env.VITE_SUPABASE_URL_GLAS,
  process.env.VITE_SUPABASE_API_KEY_GLAS
)

  const docs = await buildDocuments()
  console.log(`Loaded ${docs.length} chunks from data/`)

  await SupabaseVectorStore.fromDocuments(docs, embeddings, {
    client,
    tableName: "documents"
  })

  console.log("Documents uploaded")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
