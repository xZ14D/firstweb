import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [phrases, setPhrases] = useState([])
  const [newPhrase, setNewPhrase] = useState('')

  useEffect(() => {
    getPhrases()
  }, [])

  async function addPhrase(Phrase) {
    if (!Phrase.trim()) return // don't add empty phrases

    const { data, error } = await supabase
      .from('phrases')
      .insert([{ phrase: Phrase }])
      .select()
    if (error) {
      console.error('Error adding phrase:', error)
    } else {
      setPhrases([...phrases, ...data])
      setNewPhrase('') // clear the input after adding
    }
  }

  async function getPhrases() {
    const { data, error } = await supabase
      .from('phrases')
      .select('*')
    if (error) {
      console.error('Error fetching phrases:', error)
    } else {
      setPhrases(data)
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
        onKeyDown={(e) => e.key === 'Enter' && addPhrase(newPhrase)}
        placeholder="Enter a phrase"
      />
      <button onClick={() => addPhrase(newPhrase)}>Add</button>
      <ul>
        {phrases.map((phrase) => (
          <li key={phrase.id}>{phrase.phrase}</li>
        ))}
      </ul>
    </>
  )
}

export default App