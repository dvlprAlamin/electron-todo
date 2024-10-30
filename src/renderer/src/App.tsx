import Versions from './components/Versions'

function App(): JSX.Element {
  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <>
      <div className="actions">
        <div className="action">
          <a href="https://electron-vite.org/" target="_blank" rel="noreferrer">
            Documentation
          </a>
        </div>
        <div className="action">
          <a target="_blank" rel="noreferrer" onClick={ipcHandle}>
            Send IPC
          </a>
        </div>
      </div>
      <p>
        Lorem ipsum dolor, sit amet consectetur adipisicing elit. Omnis sint repudiandae officia
        deserunt expedita adipisci eligendi saepe hic unde doloribus commodi voluptas cum alias
        fugiat, tempora id! Harum dignissimos laborum rem natus possimus nobis facilis repellat
        adipisci molestiae, nisi fuga nihil perferendis distinctio dicta ea quis sequi quasi
        placeat, perspiciatis veritatis blanditiis obcaecati inventore. Aperiam quas, odio, eos
        soluta minima tempore maxime numquam sed at cumque, cupiditate libero ea debitis ducimus hic
      </p>
      <Versions></Versions>
    </>
  )
}

export default App
