import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRightLong } from '@fortawesome/free-solid-svg-icons'
import { faStop } from "@fortawesome/free-solid-svg-icons";

const allMyths = [
  "Will lifting heavy weights make you bulky",
  "Are longer workouts better",
  "Does more sweat equals a better workout",
  "Does stretching helps prevent injuries",
  "Can you spot reduce fat",
  "If I don't feel sore after my workout, does that mean I didn't work hard enough",
  "Should older people lift weights",
  "Should I avoid Carbohydrates when trying to lose weight",
  "If i don't workout, Will my muscles turn into fat",
  "Is it true I need to rush to consume protein within 30 minutes after my workout to maximize muscle growth",
  "Does lifting weights stop you from growing taller",
  "Can I eat whatever junk food I want as long as I work out regularly"
]

function App() {

  const [text, setText] = useState('');
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [questionAsked, setQuestionAsked] = useState(false);
  const [messages, setMessages] = useState([]); 
  const textareaRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortCtrlRef = useRef(null);
  const typingIndexRef = useRef(null);
  const containerRef = useRef(null)
  const messageRefs = useRef([])
  const [suggestions, setSuggestions] = useState(() => pickFour(allMyths))
  const [chatList, setChatList] = useState([]);
  const [currentChatId, setCurrentId] = useState(null);
  const [chatsMeta, setChatsMeta] = useState({});
  const [settingsFor, setSettingsFor] = useState(null);

  // Creating a chat on the server 
  async function createChat() {
    // Sending POST request to create new chat and get its ID
    const { id } = await fetch("http://localhost:8000/api/chats", { method: "POST" })
    .then(r => r.json());
    // Adding new chat ID to the beginning of chat list
    setChatList(prev => [id, ...prev]);
    // Setting this new chat as currently active chat 
    setCurrentId(id);
    // Initializing meta deta for this chat 
    setChatsMeta(m => ({
      ...m,
      [id]: { title: "New chat" }
    }));
    return id;
  }
  
  // fetches all chats from the server
  useEffect(() => {
    fetch("http://localhost:8000/api/chats")
      .then(r => r.json())
      .then(list=> {
        // filling chat list 
        setChatList(list.map(c=>c.id));
        // Creating a metadata object with titles indexed by chat ID
        const m = {};
        list.forEach(c=> m[c.id] = { title: c.title });
        setChatsMeta(m);
      });
  }, []);

  // Openining and loading a specific chat by its ID 
  function openChat(id) {
    // Setting requested chat as current active chat
    setCurrentId(id);
    messageRefs.current = [];
    // fetching the messages for this specific chat 
    fetch(`http://localhost:8000/api/chats/${id}`)
      .then(r => r.json())
      .then(data => {
        // Updating the messages state with the fetched messages
        setMessages(data.messages);
        // Controls showing the chat view or the home screen
        setQuestionAsked(data.messages.length > 0);
      });
  }

  // randomly selects 4 elements from the array
  function pickFour(arr) {
    // creating a copy of the array for modification
    const copy = [...arr];
    // implementing Knuth shuffle algorithm
    for (let i = copy.length - 1; i > 0; i--) {
      // generating a random index between 0 and 1
      const j = Math.floor(Math.random() * (i + 1));
      //swapping elements for creating randomization effect
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    // returning only the first 4 elements
    return copy.slice(0, 4);
  }
  
  // runs only once on component mount 
  useEffect(() => {
    // updating the component state with the 4 randomly selected myths 
    setSuggestions(pickFour(allMyths));
  }, []);

  const handleTextChange = (e) => {
    const newText = e.target.value;

    // Update the textarea height dynamically
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';

    // Update the text state and button's disabled state
    setText(newText);
    setIsButtonDisabled(newText.trim() === ''); // Disable the button if the text is empty
  };

  // Toggle Sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleNewChat = async () => {

    // 1) create server-side chat
    const { id } = await fetch("http://localhost:8000/api/chats", { method: "POST" })
    .then(r => r.json());

    setChatList(prev => [id, ...prev]);
    setCurrentId(id);
    // give it the “New chat” default in your local cache
    setChatsMeta(m => ({
      ...m,
      [id]: { title: "New chat" }
    }));

    setQuestionAsked(false);
    // Clear the input field
    setText('');
    messageRefs.current = [];
    // Clear messages if you want a fresh conversation:
    setMessages([]);
    // Reset the textarea height if needed
    if (textareaRef.current) {
      textareaRef.current.style.height = '22px';
      textareaRef.current.style.height = 'auto';
    }
    setSuggestions(pickFour(allMyths));
  }

  useLayoutEffect(() => {
    if (!containerRef.current || messageRefs.current.length === 0) return;
    const c = containerRef.current;
    const count     = messages.length;
    if (!c || count === 0) return;
    const last = messageRefs.current[count - 1];
    if (last) {
      c.scrollTo({ top: last.offsetTop, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
  
    const question = text.trim();

    // Checking if this was the very first message in this chat
    const isFirstMessage = !questionAsked;
  
    // pushing the user message
    setMessages((prev) => [...prev, { text: question, sender: "user" }]);
  
    // resetting input 
    setText("");

    if (isFirstMessage) {
      setQuestionAsked(true);
    }

    // Resizing the text area after entering alot of text 
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = '22px';
      textarea.style.height = 'auto';
    } else {
      console.log("Textarea not found in handleSendMessage.");
    }

    setIsButtonDisabled(true);
    if (!questionAsked) setQuestionAsked(true);

    // ensuring chat exists
    const id = currentChatId || await createChat();
    // persisting  user message
    await fetch(`http://localhost:8000/api/chats/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: "user", text: question })
    });

    // renaming the chat to this question if it was the first question 
    if (isFirstMessage) {
      await fetch(`http://localhost:8000/api/chats/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: question })
      });
      // updateing local cache of titles
      setChatsMeta(m => ({
        ...m,
        [id]: { title: question }
      }));
    }
  
    // starting the Ai's response
    askQuestion(question, id);
  };
  

  // This drives the POST → stub → type-writer animation
  async function askQuestion(question, chatId) {
    // Ensuring chatID is present
    chatId = chatId || currentChatId;
    // Setting up abort controller to cancel the request
    const controller = new AbortController();
    abortCtrlRef.current = controller;
    // Showing blinking carot 
    setIsLoading(true);

    try {
      // Sending question to /api/ask endpoint
      const res = await fetch("http://localhost:8000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });
      const { answer } = await res.json();

      // hiding loader once the answer arrives
      setIsLoading(false);

      // adding a temporary AI message placeholder
      setMessages((prev) => {
        const stub = {
          sender: "ai",
          fullText: answer,
          displayedText: "",
          isTyping: true,
        };
        typingIndexRef.current = prev.length;
        return [...prev, stub];
      });

      // persisting the full answer to chat history 
      const resp = await fetch(`http://localhost:8000/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ sender: "ai", text: answer })
      });

      console.log("AI‐message persisted? →", resp.status, await resp.text());

      // typewriter effect
      let i = 0;
      const interval = setInterval(() => {
        setMessages((prev) => {
          const msgs = [...prev];
          const idx = typingIndexRef.current;
          const next = answer.slice(0, i + 1);
          // revealing one more character in displayedText
          msgs[idx] = { ...msgs[idx], displayedText: next };
          return msgs;
        });
        i++;
        if (i >= answer.length) {
          clearInterval(interval);
          // marking that typing is complete so static disapears 
          setMessages((prev) => {
            const copy = [...prev];
            copy[typingIndexRef.current].isTyping = false;
            return copy;
          });
        }
      }, 12); //speed of 12ms per character 

    } catch (err) {
      setIsLoading(false);
      const errText = err.name === "AbortError"
      ? "Response aborted"
      : "Error fetching response";

      // showing error in the UI
      setMessages((prev) => [
        ...prev,
        { text: errText, sender: "ai" },
      ]);

      // Persisting the error message to the server 
      await fetch(`http://localhost:8000/api/chats/${currentChatId}/messages`, {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ sender: "ai", text: errText })
      });
    } finally {
      // cleaning up abort controller reference
      abortCtrlRef.current = null;
    }
  }

  
  function renderAIResponse(text) {
    // Defining regex patterns for URLs and keywords
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const keywordRegex = /(Conclusion:|Rationale:)/g;
  
    // Splitting text by URLs and processing each part 
    return text.split(urlRegex).map((part, i) => {
      if (urlRegex.test(part)) {
        // Cleaning any trailing punctuation
        const cleanUrl = part.replace(/[\)\]\.,;:]+$/g, "");
        // enclosing URLs in anchor tags 
        return (
          <a
            key={`url-${i}`}
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {cleanUrl}
          </a>
        );
      } else {
        // splitting further on the keywords
        return part
          .split(keywordRegex)
          .map((seg, j) =>
            keywordRegex.test(seg)
              ? <strong key={`kw-${i}-${j}`}>{seg}</strong> // Emphasizing keywords
              : <span key={`txt-${i}-${j}`}>{seg}</span>
          );
      }
    });
  }

  const renameChat = async () => {
    const id = settingsFor;
    const currentTitle = chatsMeta[id]?.title || '';
    const newTitle = prompt("Rename chat:", currentTitle);
    if (!newTitle) {
      setSettingsFor(null);
      return;
    }
    await fetch(`http://localhost:8000/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setChatsMeta(m => ({
      ...m,
      [id]: { title: newTitle }
    }));
    setSettingsFor(null);
  };

  const deleteChat = async () => {
    const id = settingsFor;
    if (!window.confirm("Delete this chat?")) {
      setSettingsFor(null);
      return;
    }
    await fetch(`http://localhost:8000/api/chats/${id}`, { method: "DELETE" });
    setChatList(list => list.filter(x => x !== id));
    if (currentChatId === id) {
      setCurrentId(null);
      setMessages([]);
      setQuestionAsked(false);
    }
    setSettingsFor(null);
  };
     
  return (
    <div className="background">
      <div className="Navbar">
        <button className="sidebar" onClick={toggleSidebar}>
          <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="1.5"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-layout-sidebar"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M9 4l0 16" /></svg>
        </button>
        <button className="newchat" onClick={handleNewChat}>
          <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50" viewBox="0 0 48 48"><path d="M 35 2 C 28.925 2 24 6.925 24 13 C 24 19.075 28.925 24 35 24 C 41.075 24 46 19.075 46 13 C 46 6.925 41.075 2 35 2 z M 35 5 C 35.552 5 36 5.448 36 6 L 36 12 L 42 12 C 42.552 12 43 12.448 43 13 C 43 13.552 42.552 14 42 14 L 36 14 L 36 20 C 36 20.552 35.552 21 35 21 C 34.448 21 34 20.552 34 20 L 34 14 L 28 14 C 27.448 14 27 13.552 27 13 C 27 12.448 27.448 12 28 12 L 34 12 L 34 6 C 34 5.448 34.448 5 35 5 z M 10.5 7 C 6.92 7 4 9.92 4 13.5 L 4 30.5 C 4 34.08 6.92 37 10.5 37 L 12 37 L 12 42.5 C 12 43.45 12.530859 44.310234 13.380859 44.740234 C 13.740859 44.910234 14.12 45 14.5 45 C 15.03 45 15.56 44.83 16 44.5 L 26 37 L 37.5 37 C 41.08 37 44 34.08 44 30.5 L 44 22.369141 C 43.11 23.229141 42.1 23.959297 41 24.529297 L 41 30.5 C 41 32.43 39.43 34 37.5 34 L 25.5 34 C 25.18 34 24.859609 34.110781 24.599609 34.300781 L 15 41.5 L 15 35.5 C 15 34.67 14.33 34 13.5 34 L 10.5 34 C 8.57 34 7 32.43 7 30.5 L 7 13.5 C 7 11.57 8.57 10 10.5 10 L 22.349609 10 C 22.599609 8.94 22.980703 7.94 23.470703 7 L 10.5 7 z"></path></svg>
        </button>
      </div>
      {isSidebarOpen && (
        <div className="sidebar-content">
          <div className="sidebar-open-icons">
            <button className="sidebar" onClick={toggleSidebar}>
              <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="1.5"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-layout-sidebar"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" /><path d="M9 4l0 16" /></svg>
            </button>
            <button className="newchat" onClick={handleNewChat}>
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="50" height="50" viewBox="0 0 48 48"><path d="M 35 2 C 28.925 2 24 6.925 24 13 C 24 19.075 28.925 24 35 24 C 41.075 24 46 19.075 46 13 C 46 6.925 41.075 2 35 2 z M 35 5 C 35.552 5 36 5.448 36 6 L 36 12 L 42 12 C 42.552 12 43 12.448 43 13 C 43 13.552 42.552 14 42 14 L 36 14 L 36 20 C 36 20.552 35.552 21 35 21 C 34.448 21 34 20.552 34 20 L 34 14 L 28 14 C 27.448 14 27 13.552 27 13 C 27 12.448 27.448 12 28 12 L 34 12 L 34 6 C 34 5.448 34.448 5 35 5 z M 10.5 7 C 6.92 7 4 9.92 4 13.5 L 4 30.5 C 4 34.08 6.92 37 10.5 37 L 12 37 L 12 42.5 C 12 43.45 12.530859 44.310234 13.380859 44.740234 C 13.740859 44.910234 14.12 45 14.5 45 C 15.03 45 15.56 44.83 16 44.5 L 26 37 L 37.5 37 C 41.08 37 44 34.08 44 30.5 L 44 22.369141 C 43.11 23.229141 42.1 23.959297 41 24.529297 L 41 30.5 C 41 32.43 39.43 34 37.5 34 L 25.5 34 C 25.18 34 24.859609 34.110781 24.599609 34.300781 L 15 41.5 L 15 35.5 C 15 34.67 14.33 34 13.5 34 L 10.5 34 C 8.57 34 7 32.43 7 30.5 L 7 13.5 C 7 11.57 8.57 10 10.5 10 L 22.349609 10 C 22.599609 8.94 22.980703 7.94 23.470703 7 L 10.5 7 z"></path></svg>
            </button>
          </div>
          <div className='recent-chats'>
            <h3>Recent</h3>
            {chatList.map(id => (
              <div
                key={id}
                className={`chat-card ${id === currentChatId ? "chat-card--active" : ""}`}
                onClick={() => openChat(id)}
              >
                <span className="chat-title">
                  {chatsMeta[id]?.title || `Chat ${id.slice(0,4)}`}
                </span>
                <button
                  className="chat-settings-btn"
                  onClick={e => {
                    e.stopPropagation();
                    setSettingsFor(settingsFor === id ? null : id);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="2"/>
                    <circle cx="12" cy="12" r="2"/>
                    <circle cx="19" cy="12" r="2"/>
                  </svg>
                </button>

                {settingsFor === id && (
                  <div className="chat-menu-popup" onClick={e => e.stopPropagation()}>
                    <button className="chat-menu-item" onClick={renameChat}>
                      Rename
                    </button>
                    <button className="chat-menu-item delete" onClick={deleteChat}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* <div className="main-wrapper"> */}
        {!questionAsked ? (
          // Home screen view with the suggestion cards 
          <>
            <div className="main-wrapper">
              <div className="header-wrapper">
                <h1>What myth would you like to debunk?</h1>
              </div>
              <div className="suggestion-cards">
                {suggestions.map((myth, idx) =>
                  <button
                    key={idx}
                    className="suggestion-card"
                    onClick={async () => {
                      messageRefs.current = [];
                      // showing chat view
                      setQuestionAsked(true);
                      // ensuring there is a chat
                      const id = currentChatId || await createChat();
                      // seeding the user's message
                      setMessages([{ text: myth, sender: "user" }]);
                      // persisting the user's message
                      await fetch(`http://localhost:8000/api/chats/${id}/messages`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sender: "user", text: myth })
                      });
                      // renaming the chat to that myth
                      await fetch(`http://localhost:8000/api/chats/${id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ title: myth })
                      });
                      setChatsMeta(m => ({ ...m, [id]: { title: myth } }));
                      // disabling the input under the hood
                      setIsButtonDisabled(true);
                      // starting the AI's response
                      askQuestion(myth, id);
                    }}
                  >
                    {myth}
                  </button>
                )}
              </div>
              <div className="input-wrapper">
                <form className="input-container" onSubmit={handleSendMessage}>
                  <textarea
                    placeholder="Ask anything..."
                    rows="1"
                    onChange={handleTextChange}
                    value={text}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { // Checking if Enter is pressed without Shift
                        e.preventDefault();
                        handleSendMessage(e); // Calling the function to send the message
                      }
                    }}
                  />
                  <button
                    className={`send-btn ${text.trim() ? 'active' : ''}`}
                    type="submit"
                    disabled={isButtonDisabled}
                  >
                    <FontAwesomeIcon icon={faRightLong} />
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : (
          // Chat View
          <>
            <div className='messages-wrapper-container' ref={containerRef}>
              <div className="messages-wrapper">
                <div className="chat-container" >
                {messages.map((msg,i) => (
                  <div
                    key={i}
                    // storing reference to each message
                    ref={el => { messageRefs.current[i] = el }}
                    className={msg.sender==='user'?'user-message':'ai-response'}
                  >
                    {msg.sender==='ai' ? (
                      <>
                        {/* Cleaning Ai's response to desired format */}
                        {renderAIResponse(msg.displayedText ?? msg.text)}
                        
                        {/* Showing non blinking caret while this specific message is typed */}
                        {msg.isTyping && <span className="static-caret" />}

                        {/* after typing no carot is shown */}
                      </>
                    ) : (
                      // displaying user bubble
                      <span>{msg.text}</span>
                    )}
                  </div>
                ))}
                  {isLoading && (
                    <div className="ai-response">
                      <span className="blinking-caret"></span>
                    </div>
                  )}
                </div>
              </div>
              <div className='input-wrapper-aftr-frst-msg-container'>
                <div className='input-wrapper-aftr-frst-msg'>
                  <form className="input-container-aftr-frst-msg" onSubmit={handleSendMessage}>
                    <textarea
                      ref={textareaRef}
                      placeholder="Message MythAI"
                      rows="1"
                      onChange={handleTextChange}
                      value={text}
                      disabled={isLoading}               // disable input while loading
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { // Check if Enter is pressed without Shift
                          e.preventDefault(); // Prevent the default behavior (new line)
                          handleSendMessage(e); // Call the function to send the message
                        }
                      }}
                    />
                    {isLoading ? (
                      // Stop button + blinking caret
                      <button
                        type="button"
                        className="stop-btn"
                        onClick={() => {
                          abortCtrlRef.current?.abort();
                        }}
                      >
                        <FontAwesomeIcon icon={faStop} />
                      </button>
                    ) : (
                      // Normal send arrow
                      <button
                        className={`send-btn-aftr-frst-msg ${text.trim() ? 'active' : ''}`}
                        type="submit"
                        disabled={isButtonDisabled}
                      >
                        <FontAwesomeIcon icon={faRightLong} />
                      </button>
                    )}
                  </form>
                </div>
              </div>
            </div>
        </>
        )}
      {/* </div> */}
    </div>
  );
}

export default App;
