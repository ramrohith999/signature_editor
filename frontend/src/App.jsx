import "react-pdf/dist/esm/Page/TextLayer.css";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

let fieldOffset = 0;

const createField = (type) => {
  fieldOffset += 20;
  return {
    id: crypto.randomUUID(),
    type,
    x: 80 + fieldOffset,
    y: 80 + fieldOffset,
    width: 160,
    height: 40,
    xRatio: null,
    yRatio: null,
    widthRatio: null,
    heightRatio: null,
    value: "",
  };
};

const SignatureCanvas = ({ field, onChange }) => {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;

    if (field.value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = field.value;
    }
  }, [field.value, field.width, field.height]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const start = (e) => {
    e.stopPropagation();
    e.preventDefault();
    isDrawing.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <canvas
      ref={canvasRef}
      width={field.width}
      height={field.height}
      className="border bg-white cursor-crosshair touch-none"
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={end}
    />
  );
};

export default function App() {
  const [pageSize, setPageSize] = useState(null);
  const [fields, setFields] = useState([]);

  const containerRef = useRef(null);
  const dragRef = useRef({
    fieldId: null,
    mode: null,
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    mouseX: 0,
    mouseY: 0,
  });

  const addField = (type) => {
    setFields((prev) => [...prev, createField(type)]);
  };

  const onMouseDown = (e, field, mode = "drag") => {
    e.preventDefault();
    dragRef.current = {
      fieldId: field.id,
      mode,
      startX: field.x,
      startY: field.y,
      startW: field.width,
      startH: field.height,
      mouseX: e.clientX,
      mouseY: e.clientY,
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e) => {
    const drag = dragRef.current;
    if (!drag.fieldId) return;

    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== drag.fieldId) return f;

        const dx = e.clientX - drag.mouseX;
        const dy = e.clientY - drag.mouseY;
        const container = containerRef.current.getBoundingClientRect();

        if (drag.mode === "drag") {
          const nextX = Math.max(0, Math.min(drag.startX + dx, container.width - f.width));
          const nextY = Math.max(0, Math.min(drag.startY + dy, container.height - f.height));
          return { ...f, x: nextX, y: nextY };
        }

        if (drag.mode === "resize") {
          const nextW = Math.max(60, drag.startW + dx);
          const nextH = Math.max(30, drag.startH + dy);
          return { ...f, width: nextW, height: nextH };
        }

        return f;
      })
    );
  };

  const onMouseUp = () => {
    const drag = dragRef.current;
    if (!drag.fieldId || !containerRef.current) {
      dragRef.current.fieldId = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      return;
    }

    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== drag.fieldId) return f;

        const rect = containerRef.current.getBoundingClientRect();
        return {
          ...f,
          xRatio: f.x / rect.width,
          yRatio: f.y / rect.height,
          widthRatio: f.width / rect.width,
          heightRatio: f.height / rect.height,
        };
      })
    );

    dragRef.current.fieldId = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    if (!pageSize) return;

    setFields((prev) =>
      prev.map((f) => {
        if (
          f.xRatio == null ||
          f.yRatio == null ||
          f.widthRatio == null ||
          f.heightRatio == null
        ) {
          return f;
        }

        return {
          ...f,
          x: f.xRatio * pageSize.width,
          y: f.yRatio * pageSize.height,
          width: f.widthRatio * pageSize.width,
          height: f.heightRatio * pageSize.height,
        };
      })
    );
  }, [pageSize]);

  const buildNormalizedFields = () => {
    if (!containerRef.current) return [];

    const rect = containerRef.current.getBoundingClientRect();

    return fields.map((f) => {
      const xRatio = f.x / rect.width;
      const yRatio = f.y / rect.height;
      const widthRatio = f.width / rect.width;
      const heightRatio = f.height / rect.height;

      return {
        id: f.id,
        type: f.type,
        value: f.value,
        xRatio,
        yRatio,
        widthRatio,
        heightRatio,
      };
    });
  };

  const renderFieldContent = (field) => {
    switch (field.type) {
      case "text":
        return (
          <input
            className="w-full h-full text-xs p-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            placeholder="Text"
            value={field.value}
            onChange={(e) =>
              setFields((prev) =>
                prev.map((f) =>
                  f.id === field.id ? { ...f, value: e.target.value } : f
                )
              )
            }
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />
        );

      case "date":
        return (
          <input
            type="date"
            className="w-full h-full text-xs p-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            value={field.value}
            onChange={(e) =>
              setFields((prev) =>
                prev.map((f) =>
                  f.id === field.id ? { ...f, value: e.target.value } : f
                )
              )
            }
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />
        );

      case "radio":
        return (
          <div className="text-xs">
            {["Yes", "No"].map((opt) => (
              <label key={opt} className="block">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={field.value === opt}
                  onChange={() =>
                    setFields((prev) =>
                      prev.map((f) =>
                        f.id === field.id ? { ...f, value: opt } : f
                      )
                    )
                  }
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                />{" "}
                {opt}
              </label>
            ))}
          </div>
        );

      case "image":
        return field.value ? (
          <img
            src={field.value}
            alt="uploaded"
            className="w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <input
            type="file"
            accept="image/*"
            className="text-xs rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                setFields((prev) =>
                  prev.map((f) =>
                    f.id === field.id ? { ...f, value: reader.result } : f
                  )
                );
              };
              reader.readAsDataURL(file);
            }}
          />
        );

      case "signature":
        return (
          <SignatureCanvas
            field={field}
            onChange={(dataUrl) =>
              setFields((prev) =>
                prev.map((f) =>
                  f.id === field.id ? { ...f, value: dataUrl } : f
                )
              )
            }
          />
        );

      default:
        return null;
    }
  };

  const signPdf = async () => {
    const normalizedFields = buildNormalizedFields();
    if (normalizedFields.length === 0) {
      alert("Place and resize fields before signing.");
      return;
    }
    // const res = await fetch("http://localhost:5001/sign-pdf", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     pdfId: "sample.pdf",
    //     fields: normalizedFields,
    //   }),
    // });
// for render deployment
    const res = await fetch(
  "https://signature-editor.onrender.com/sign-pdf",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pdfId: "sample.pdf",
      fields: normalizedFields,
    }),
  }
);
    const data = await res.json();
    console.log("Signed PDF:", data);
  };

  return (
    // <div
    //   className="min-h-screen bg-cover bg-center bg-no-repeat flex items-start justify-center py-12 relative"
    //   style={{ backgroundImage: "url('/src/assets/background.jpg')" }}
    // >
// removed background image and stuck to plain bg for better visibility
    <div className="min-h-screen bg-gray-100 flex items-start justify-center py-12">
      <div className="absolute inset-0 bg-black/30"></div>
      <div className="relative bg-white shadow-xl rounded-xl p-6 w-full max-w-6xl">
        <h1 className="text-2xl italic font-semibold mb-6 text-gray-900">
          PDF Signature <span className="font-sans text-3xl text-emerald-600 sha"> & </span>Field Editor
        </h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <button className="px-4 py-2 rounded-md text-sm font-medium bg-blue-400 text-white hover:bg-blue-700 transition cursor-pointer" onClick={() => addField("signature")}>Signature</button>
          <button className="px-4 py-2 rounded-md text-sm font-medium bg-blue-400 text-white hover:bg-blue-700 transition cursor-pointer" onClick={() => addField("image")}>Image</button>
          <button className="px-4 py-2 rounded-md text-sm font-medium bg-blue-400 text-white hover:bg-blue-700 transition cursor-pointer" onClick={() => addField("text")}>Text</button>
          <button className="px-4 py-2 rounded-md text-sm font-medium bg-blue-400 text-white hover:bg-blue-700 transition cursor-pointer" onClick={() => addField("date")}>Date</button>
          <button className="px-4 py-2 rounded-md text-sm font-medium bg-blue-400 text-white hover:bg-blue-700 transition cursor-pointer" onClick={() => addField("radio")}>Radio</button>
        </div>

        <div
          ref={containerRef}
          className="relative inline-block border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-inner"
        >
          <div style={{ pointerEvents: "none" }}>
            <Document file="/sample.pdf">
              <Page
                pageNumber={1}
                onLoadSuccess={(page) => {
                  setPageSize({
                    width: page.view[2],
                    height: page.view[3],
                  });
                }}
              />
            </Document>
          </div>

          {fields.map((field) => (
            <div
              key={field.id}
              className="absolute border border-blue-400 bg-white text-xs p-1 shadow-lg rounded-md"
              style={{
                left: field.x,
                top: field.y,
                width: field.width,
                height: field.height,
              }}
            >
              <div
                className="h-2 bg-blue-200 cursor-move mb-1 rounded"
                onMouseDown={(e) => onMouseDown(e, field, "drag")}
              />

              {renderFieldContent(field)}

              <div
                className="absolute bottom-0 right-0 w-3 h-3 bg-blue-600 cursor-se-resize rounded-sm"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onMouseDown(e, field, "resize");
                }}
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button onClick={signPdf} className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition shadow cursor-pointer">
            Sign PDF
          </button>
        </div>
      </div>
    </div>
  );
}