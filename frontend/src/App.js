import { useState, useRef } from 'react';
import './App.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRightLong } from '@fortawesome/free-solid-svg-icons'

function App() {

  const [text, setText] = useState('');
  const [isButtonDisabled, setIsButtonDisabled] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [questionAsked, setQuestionAsked] = useState(false);
  const [messages, setMessages] = useState([]); // New state for storing messages
  const textareaRef = useRef(null);

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

  const handleNewChat = () => {
    setQuestionAsked(false);
    // Clear the input field
    setText('');
    // Clear messages if you want a fresh conversation:
    setMessages([]);
    // Reset the textarea height if needed
    if (textareaRef.current) {
      textareaRef.current.style.height = '22px';
      textareaRef.current.style.height = 'auto';
    }
  }

  // Handle form submission and store messages
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (text.trim()) {
  
      // Add user message to the messages array
      setMessages((prev) => [...prev, { text, sender: 'user' }]);
      const userQuestion = text;
      // setMessages((prevMessages) => [
      //   ...prevMessages,
      //   { text, sender: 'user' },
      // ]);
    
      // Clear the input field
      setText(''); // This clears the form input
  
      // Access the textarea directly from the form (using e.target)
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.style.height = '22px';
        textarea.style.height = 'auto';
      } else {
        console.log("Textarea not found in handleSendMessage.");
      }
  
      if (!questionAsked) {
        setQuestionAsked(true); // Switch to the second view after the first message
      }
  
      // Simulate AI response after a slight delay
      // setTimeout(() => {
      //   console.log("Simulating AI response");
      //   setMessages((prevMessages) => [
      //     ...prevMessages,
      //     { text: "This is a simulated AI response.", sender: 'ai' },
      //   ]);
      // }, 500);
      try {
        // Send a POST request to /echo
        const response = await fetch("http://localhost:8000/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text }),
        });
    
        const data = await response.json();
    
        // Display the echoed response in your chat
        setMessages((prev) => [
          ...prev,
          {
            text: data.answer, // The placeholder or eventually your GPT-like summary
            sender: "ai",
          },
          {
            text: `Top chunks: ${JSON.stringify(data.topChunks, null, 2)}`,
            sender: "ai",
          },
        ]);
      } catch (error) {
        console.error("Error sending message to server:", error);
      }
    } else {
      console.log("No text entered to send."); 
    }
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
            <p>Effects of intermittent</p>
            <p>Best way to gain mus</p>
            <p>Hydration in fat loss</p>
          </div>
        </div>
      )}
      {/* <div className="main-wrapper"> */}
        {!questionAsked ? (
          // Initial View
          <>
            <div className="main-wrapper">
              <div className="header-wrapper">
                <h1>What myth would you like to debunk?</h1>
              </div>
              <div className="input-wrapper">
                <form className="input-container" onSubmit={handleSendMessage}>
                  <textarea
                    placeholder="Ask anything..."
                    rows="1"
                    onChange={handleTextChange}
                    value={text}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { // Check if Enter is pressed without Shift
                        e.preventDefault(); // Prevent the default behavior (new line)
                        handleSendMessage(e); // Call the function to send the message
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
            <div className='messages-wrapper-container'>
              <div className="messages-wrapper">
                <div className="chat-container">
                  {messages.map((message, index) => (
                    <div key={index} className={message.sender === 'user' ? 'user-message' : 'ai-response'}>
                      {message.text}
                    </div>
                  ))}
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
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { // Check if Enter is pressed without Shift
                          e.preventDefault(); // Prevent the default behavior (new line)
                          handleSendMessage(e); // Call the function to send the message
                        }
                      }}
                    />
                    <button
                      className={`send-btn-aftr-frst-msg ${text.trim() ? 'active' : ''}`}
                      type="submit"
                      disabled={isButtonDisabled}
                    >
                      <FontAwesomeIcon icon={faRightLong} />
                    </button>
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
