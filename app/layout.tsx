import "./globals.css";
import Image from "next/image";

export const metadata = {
  title: "ALRAKEEN | Teltonika CAN Recommender",
  description: "Upload Excel → get recommended Teltonika CAN device + adapters, with PDF & Excel reports."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div className="container">
          <div className="nav">
            <div className="brand">
              <Image src="/logo.png" alt="ALRAKEEN" width={46} height={46} style={{borderRadius:12}} />
              <div>
                <div style={{fontWeight:900}}>ALRAKEEN</div>
                <div className="small">Teltonika CAN • Excel/PDF • Vercel</div>
              </div>
            </div>
            <div className="row">
              <a className="badge" href="/planner">خطة التركيب (Planner)</a>
              <a className="badge" href="/wiring">طرق التوصيل (Wiring)</a>
              <span className="badge">UI: White + Blue</span>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
