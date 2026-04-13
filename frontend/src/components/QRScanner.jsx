import { useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

function QRScanner() {
  const navigate = useNavigate();

  useEffect(() => {
    const scanner = new Html5Qrcode("reader");

    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        const codigo = decodedText.split("/verify/")[1];
        if (codigo) {
          scanner.stop();
          navigate(`/verify/${codigo}`);
        }
      }
    );

    return () => {
      scanner.stop().catch(() => {});
    };
  }, []);

  return <div id="reader" style={{ width: "300px", margin: "auto" }} />;
}

export default QRScanner;