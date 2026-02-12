import { Routes, Route } from "react-router-dom";
import { IconPicker } from "./custom-elements/IconPicker";

function App() {
  return (
    <Routes>
      <Route path="/icon-picker" element={<IconPicker />} />
    </Routes>
  );
}

export default App;
