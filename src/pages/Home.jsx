import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient"; // note the ../ since we're inside /pages

function Camera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }, // "environment" for rear camera
          audio: false,
        });

        // If the component unmounted while waiting for permission
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError(err.name + ": " + err.message);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) return <p>Could not access camera: {error}</p>;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ width: "100%", maxWidth: 640 }}
    />
  );
}

export default function Home() {
  const [phrases, setPhrases] = useState([]);
  const [newPhrase, setNewPhrase] = useState("");

  useEffect(() => {
    getPhrases();
  }, []);

  async function addPhrase(phrase) {
    if (!phrase.trim()) return; // don't add empty phrases

    const { data, error } = await supabase
      .from("phrases")
      .insert([{ phrase }])
      .select();

    if (error) {
      console.error("Error adding phrase:", error);
    } else {
      setPhrases([...phrases, ...data]);
      setNewPhrase(""); // clear the input after adding
    }
  }

  async function getPhrases() {
    const { data, error } = await supabase.from("phrases").select("*");

    if (error) {
      console.error("Error fetching phrases:", error);
    } else {
      setPhrases(data);
    }
  }

  return (
    <>
      <h1>skibidi</h1>
      <h2>write what you want</h2>

      <input
        type="text"
        value={newPhrase}
        onChange={(e) => setNewPhrase(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && addPhrase(newPhrase)}
        placeholder="Enter a phrase"
      />
      <button onClick={() => addPhrase(newPhrase)}>Add</button>

      <ul>
        {phrases.map((p) => (
          <li key={p.id}>{p.phrase}</li>
        ))}
      </ul>

      <Camera />
    </>
  );
}