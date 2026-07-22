export default function UploadProgress({ progress }) {
  return (
    <div>
      <progress
        max={100}
        value={progress}
        style={{
          width: "400px",
        }}
      />

      <h3>{progress}%</h3>
    </div>
  );
}
