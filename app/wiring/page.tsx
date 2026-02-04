export default function Wiring() {
  return (
    <div className="card">
      <h1 className="h1">طرق التوصيل (Wiring)</h1>
      <p className="p">
        هنا نحط Guides وروابط Teltonika Wiki الرسمية لكل جهاز/Adapter: FMC650 (FMS/J1939), FMC150 + ALL-CAN300, FMC150 + LV-CAN200…
        <br/>الصفحة دي كمان ممكن تبقى “AI Assistant” يجاوبك: أختار أي سلك؟ فين CAN-H/CAN-L؟
      </p>
      <hr className="hr" />
      <div className="small">
        روابط مفيدة (نماذج):
        <ul>
          <li><a href="https://wiki.teltonika-gps.com/view/CAN_adapter_supported_vehicles" target="_blank">CAN adapter supported vehicles (Wiki)</a></li>
          <li><a href="https://www.teltonika-gps.com/products/trackers/professional/fmc650" target="_blank">FMC650 product page</a></li>
          <li><a href="https://www.teltonika-gps.com/products/accessories/can-adapters/all-can300" target="_blank">ALL-CAN300 product page</a></li>
        </ul>
      </div>
    </div>
  );
}
