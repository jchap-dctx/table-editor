import { Routes, Route } from "react-router-dom";
import { IconPicker } from "./custom-elements/IconPicker";
import { TableEditor } from "./custom-elements/TableEditor";
import { TableEditorPreview } from "./custom-elements";

function App() {
  return (
    <Routes>
      <Route path="/icon-picker" element={<IconPicker />} />
      <Route path="/table-editor" element={<TableEditor />} />
      <Route path="/table-editor-preview" element={<TableEditorPreview />} />
    </Routes>
  );
}

export default App;
