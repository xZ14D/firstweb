import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import "./Home.css";

// Phrases typed in the green headline (typewriter effect)
const PHRASES = [
  "a proffiesional team",
  "a fast dilivery",
  "a very good service",
];

export default function Home() {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  // Typewriter effect
  useEffect(() => {
    const current = PHRASES[phraseIndex];
    let delay = deleting ? 40 : 90;

    if (!deleting && text === current) delay = 1800; // pause when finished
    if (deleting && text === "") delay = 400;

    const timer = setTimeout(() => {
      if (!deleting && text === current) {
        setDeleting(true);
      } else if (deleting && text === "") {
        setDeleting(false);
        setPhraseIndex((i) => (i + 1) % PHRASES.length);
      } else {
        setText(
          deleting
            ? current.slice(0, text.length - 1)
            : current.slice(0, text.length + 1)
        );
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, deleting, phraseIndex]);

  return (
    <>
      <section className="firstPart">
        <div className="firstPart__content">
          <h1 className="firstPart__brand">SKIBIdi</h1>
          <h2 className="firstPart__typed">
            <span>{text}</span>
            <span className="firstPart__cursor" aria-hidden="true" />
          </h2>
          <p className="firstPart__subtitle">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Quis vero molestiae at.
          </p>
          <a href="#contact" className="firstPart__button">
            Contactez-nous
          </a>
        </div>

        <div className="firstPart__visual">
          {/* Replace with your own illustration file */}
          <img
            src="/hero-illustration.png"
            alt="nonon"
          />
        </div>

        <a
          href="https://wa.me/212600000000"
          className="firstPart__whatsapp"
          target="_blank"
          rel="noreferrer"
        >
          <span className="firstPart__whatsappLabel">Contactez-nous</span>
          <span className="firstPart__whatsappIcon" aria-label="WhatsApp">
            <svg viewBox="0 0 32 32" width="30" height="30" fill="#fff">
              <path d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8A13 13 0 0 0 16 29c7.2 0 13-5.8 13-13S23.2 3 16 3zm0 23.7c-2 0-3.9-.5-5.6-1.5l-.4-.2-4 1 1.1-3.9-.3-.4A10.7 10.7 0 1 1 16 26.700zm5.9-8c-.3-.2-1.900-.9-2.200-1-.3-.1-.5-.2-.7.2-.2.300-.8 1-1 1.200-.2.200-.4.200-.7.100-.3-.2-1.400-.5-2.600-1.600-1-.9-1.600-1.900-1.800-2.200-.2-.3 0-.5.100-.7l.5-.5c.1-.2.200-.3.300-.5.100-.2 0-.4 0-.5l-1-2.300c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1 1-1 2.500s1.100 2.900 1.200 3.100c.2.200 2.100 3.200 5.100 4.500 3 1.200 3 .8 3.600.8.600-.1 1.900-.8 2.200-1.500.3-.7.300-1.400.2-1.500-.1-.2-.3-.2-.6-.4z" />
            </svg>
          </span>
        </a>
      </section>
    </>
  );
}