export default function UploadButton({ onUpload, file, className, children }) {
  const handleClick = () => {
    if (file) {
      onUpload(file)
    }
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  )
}