import { useRef, useState } from "react";
import { supabase, insertDocument } from "../lib/supabase";
interface UploadDocumentProps {
  onClose: () => void;
  onUploaded: () => void;
}

export default function UploadDocument({
  onClose,
  onUploaded,
}: UploadDocumentProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // Upload to Supabase Storage
     const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Save metadata
      const newDocument = {
        name: file.name,
        category: "Uncategorized",
        type: fileExt?.toUpperCase() || "FILE",
        file_size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        status: "Processing",
        summary: null,
        tags: [],
        uploaded_at: new Date().toISOString(),
        file_path: publicUrl,
      };

      await insertDocument(newDocument);

      alert("Document uploaded successfully!");

      onUploaded();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-96 rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">Upload Document</h2>

        {error && (
          <p className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-full rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700"
        >
          {isUploading ? "Uploading..." : "Choose File"}
        </button>

        <button
          onClick={onClose}
          disabled={isUploading}
          className="mt-3 w-full rounded-lg border py-3"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}