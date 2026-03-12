import { Routes, Route } from "react-router-dom";
import { IconPicker } from "./custom-elements/IconPicker";
import { TableEditor } from "./custom-elements/TableEditor";

function App() {
  return (
    <Routes>
      <Route path="/icon-picker" element={<IconPicker />} />
      <Route path="/table-editor" element={<TableEditor />} />
    </Routes>
  );
}

export default App;
