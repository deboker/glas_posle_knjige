import { ChatGroq } from "@langchain/groq"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables"

import { retriever } from "/utils/retriever"
import { combineDocuments } from "/utils/combineDocuments"
import { formatConvHistory } from "/utils/formatConvHistory"

document.addEventListener('DOMContentLoaded', adjustChatContainerHeight);
window.addEventListener('resize', adjustChatContainerHeight);

let detachResizeHandler = null

function adjustChatContainerHeight() {
  const chatContainer = document.querySelector('.chatbot-conversation-container')
  const userInput = document.getElementById('user-input')
  if (!chatContainer) return

  const setHeight = () => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    chatContainer.style.height = `${viewportHeight - 150}px`
  }

  // clean up any previous handler so we don't stack listeners on every call
  if (detachResizeHandler) detachResizeHandler()

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setHeight)
    detachResizeHandler = () => window.visualViewport.removeEventListener('resize', setHeight)
  } else {
    window.addEventListener('resize', setHeight)
    detachResizeHandler = () => window.removeEventListener('resize', setHeight)
  }

  setHeight()

  // if input isn't on the page yet, skip scroll to avoid errors
  if (userInput) {
    userInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}
  

document.addEventListener('submit', (e) => {
    e.preventDefault()
    progressConversation()
})

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY


const llm = new ChatGroq({
  apiKey: groqApiKey,
  model: "llama-3.1-8b-instant",
  temperature: 0
})

const standaloneQuestionTemplate = `Given some conversation history (if any) and a question, convert the question to a standalone question. 
conversation history: {conv_history}
question: {question} 
standalone question:`
const standaloneQuestionPrompt = PromptTemplate.fromTemplate(standaloneQuestionTemplate)

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
    console.log("QUESTION:", question)

    const docs = await retriever.invoke(question)

    console.log("DOCS:", docs)

    return docs
  },
  combineDocuments
])

const answerChain = answerPrompt
    .pipe(llm)
    .pipe(new StringOutputParser())

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

const convHistory = []

async function progressConversation() {
    const userInput = document.getElementById('user-input')
    const chatbotConversation = document.getElementById('chatbot-conversation-container')
    const question = userInput.value.trim()

    if (!question) {
        alert("Please enter a question.");
        return;
    }

    if (question.length > 100) { // Adjust according to your needs
        alert("Your message is too long. Please keep it under 100 characters.");
        return;
    }

    userInput.value = ''

    // add human message
    const newHumanSpeechBubble = document.createElement('div')
    newHumanSpeechBubble.classList.add('speech', 'speech-human')
    chatbotConversation.appendChild(newHumanSpeechBubble)
    newHumanSpeechBubble.textContent = question
    chatbotConversation.scrollTop = chatbotConversation.scrollHeight
    let response
    try {
        response = await chain.invoke({
            question: question,
            conv_history: formatConvHistory(convHistory)
        })
    } catch (err) {
        console.error('LLM call failed', err)
        alert('Chyba pri volaní AI: ' + (err?.message || err))
        return
    }
    convHistory.push(question)
    convHistory.push(response)

    // add AI message
    const newAiSpeechBubble = document.createElement('div')
    newAiSpeechBubble.classList.add('speech', 'speech-ai')
    chatbotConversation.appendChild(newAiSpeechBubble)
    newAiSpeechBubble.textContent = response
    chatbotConversation.scrollTop = chatbotConversation.scrollHeight
}