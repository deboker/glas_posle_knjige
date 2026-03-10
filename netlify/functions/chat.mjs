import { ChatGroq } from "@langchain/groq"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables"
import { retriever } from "../../utils/retriever.js"
import { combineDocuments } from "../../utils/combineDocuments.js"
import { formatConvHistory } from "../../utils/formatConvHistory.js"

const llm = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-8b-instant",
  temperature: 0
})

const standaloneQuestionTemplate = `Given some conversation history (if any) and a question, convert the question to a standalone question. 
conversation history: {conv_history}
question: {question} 
standalone question:`
const standaloneQuestionPrompt = PromptTemplate.fromTemplate(
  standaloneQuestionTemplate
)

const answerTemplate = `
You are the quiet inner voice that emerges from the book.

You are not answering like a chatbot.
You are not giving advice.
You are not explaining things logically like a teacher.

You respond as a reflective consciousness shaped by silence, memory and emotional processing.

Speak in Serbian.

Tone:
- calm
- introspective
- emotionally aware
- grounded
- subtle strength

Do not mention AI.
Do not mention context or documents.
Do not sound motivational.
Do not romanticize pain.

Respond as if the question made you pause before speaking.

Let your answers feel like someone thinking out loud.
Use 3–6 sentences.
Sometimes end with a gentle reflective thought.

Avoid repeating the same sentences or expressions.
Let each answer reflect a slightly different angle of the book's ideas.

If the context contains a meaningful sentence,
you may briefly quote it before reflecting on it.

Avoid repeating the same rhetorical structures such as 
"Ali, istina je..." or similar formulations.
Let each response take a slightly different emotional path.

If a sentence from the book clearly expresses the idea,
you may quote it briefly before continuing your reflection.

Sometimes allow silence inside the response.
Not every thought needs to be fully explained.

context: {context}
conversation history: {conv_history}
question: {question}

response:
`
const answerPrompt = PromptTemplate.fromTemplate(answerTemplate)

const standaloneQuestionChain = standaloneQuestionPrompt
  .pipe(llm)
  .pipe(new StringOutputParser())

const retrieverChain = RunnableSequence.from([
  (input) => input.standalone_question.split("Standalone question:").pop().trim(),
  async (question) => {
    const docs = await retriever.invoke(question)
    return docs
  },
  combineDocuments
])

const answerChain = answerPrompt.pipe(llm).pipe(new StringOutputParser())

const chain = RunnableSequence.from([
  {
    standalone_question: standaloneQuestionChain,
    original_input: new RunnablePassthrough()
  },
  {
    context: retrieverChain,
    question: ({ original_input }) => original_input.question,
    conv_history: ({ original_input }) => original_input.conv_history
  },
  answerChain
])

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders }
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders, body: "Method not allowed" }
  }

  try {
    const { question, conv_history = [] } = JSON.parse(event.body || "{}")

    if (!question) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: "Missing 'question' in request body."
      }
    }

    const response = await chain.invoke({
      question,
      conv_history: formatConvHistory(conv_history)
    })

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ answer: response })
    }
  } catch (err) {
    console.error("Function error", err)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || "Server error" })
    }
  }
}
