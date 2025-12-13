import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; // ✅ Import serverTimestamp
import { db } from '../firebase'; // Import your Firebase Firestore instance
import xoLogo from "../assets/xo.png"; // Import the logo

const FeedbackPage = () => {
  const [statement, setStatement] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false); // Add loading state for the button

  const handleStatementChange = (e) => {
    setStatement(e.target.value);
  };

  const handleDescriptionChange = (e) => {
    setDescription(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // Prevent double submission

    if (!statement || !description) {
      setMessage('Please fill in all fields.');
      return;
    }

    setLoading(true); // Start loading

    try {
      await addDoc(collection(db, 'feedback'), {
        statement: statement,
        description: description,
        createdAt: serverTimestamp() // ✅ Changed 'timestamp' to 'createdAt' and used serverTimestamp()
      });
      setMessage('Feedback sent successfully!');
      setStatement('');
      setDescription('');
    } catch (error) {
      console.error('Error sending feedback:', error);
      setMessage('Error sending feedback. Please try again.');
    } finally {
        setLoading(false); // Stop loading
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'black',
        color: 'white',
        fontFamily: 'Doto, sans-serif', 
        minHeight: '100vh',
        padding: '30px',
        position: 'relative',
      }}
    >
      {/* Logo in the top right */}
      <img
        src={xoLogo}
        alt="Logo"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '150px',
          height: 'auto',
        }}
      />

      <h1 style={{ fontSize: '3rem', marginBottom: '40px' }}>FEEDBACK</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '30px' }}>
          <label
            htmlFor="statement"
            style={{ display: 'block', marginBottom: '10px', fontSize: '1.2rem' }}
          >
            Enter Your Statement Here
          </label>
          <input
            type="text"
            id="statement"
            value={statement}
            onChange={handleStatementChange}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: '2px solid white',
              color: 'white',
              fontFamily: 'Doto, sans-serif',
              fontSize: '1rem',
              padding: '10px 0',
              width: '100%',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '30px' }}>
          <label
            htmlFor="description"
            style={{ display: 'block', marginBottom: '10px', fontSize: '1.2rem' }}
          >
            Enter Your Description Here
          </label>
          <textarea
            id="description"
            value={description}
            onChange={handleDescriptionChange}
            rows="8"
            style={{
              backgroundColor: 'transparent',
              border: '2px solid white',
              color: 'white',
              fontFamily: 'Doto, sans-serif',
              fontSize: '1rem',
              padding: '10px',
              width: '100%',
              outline: 'none',
              resize: 'none',
            }}
          ></textarea>
        </div>

        <button
          type="submit"
          disabled={loading} // Disable button when loading
          style={{
            backgroundColor: 'white',
            border: 'none',
            color: 'black',
            cursor: 'pointer',
            fontFamily: 'Doto, sans-serif',
            fontSize: '1.5rem',
            padding: '10px 30px',
            opacity: loading ? 0.6 : 1, // Dim button when loading
          }}
        >
          {loading ? 'Sending...' : 'Send'} {/* Show status on button */}
        </button>
      </form>

      {message && (
        <p
          style={{
            marginTop: '20px',
            fontSize: '1.2rem',
            color: message.includes('Error') ? 'red' : 'white',
          }}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default FeedbackPage;