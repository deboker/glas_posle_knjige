
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
        const res = await fetch('/.netlify/functions/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            conv_history: convHistory
          })
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Function error ${res.status}`)
        }

        const data = await res.json()
        response = data.answer || ''
    } catch (err) {
        console.error('LLM call failed', err)
        const msg = err?.message || err
        alert('Chyba pri volaní AI: ' + msg)
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
