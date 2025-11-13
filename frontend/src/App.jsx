import { useEffect, useState } from "react";

function App() {
  const [status, setStatus] = useState("Loading...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/health/")
      .then((res) => res.json())
      .then((data) => setStatus(JSON.stringify(data)))
      .catch((err) => setStatus("Error: " + err.message));
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>🌱 GreenBuddy</h1>
      <p>Backend API says:</p>
      <pre>{status}</pre>
    </div>
  );
}

export default App;
