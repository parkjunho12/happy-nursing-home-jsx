"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState("/html/consult.html");

  useEffect(() => {
    setLoading(true);

    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [src]);

  const isConsult = src === "/html/consult.html";

  const changePage = () => {
    setLoading(true);
    setSrc(isConsult ? "/html/manual.html" : "/html/consult.html");
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        paddingTop: "100px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "0 20px",
          background: "#fff",
          borderBottom: "1px solid #eee",
          zIndex: 9999,
        }}
      >
        <button
          onClick={changePage}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "none",
            background: "#1a3a5c",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {isConsult ? "방문상담 매뉴얼 보기" : "전화상담 화면 보기"}
        </button>
      </div>

      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#f0f4f8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            fontSize: "16px",
            fontWeight: 600,
            color: "#1a3a5c",
          }}
        >
          페이지 불러오는 중...
        </div>
      )}

      <iframe
        src={src}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          opacity: loading ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}