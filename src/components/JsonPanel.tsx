type JsonPanelProps = {
  title: string;
  value: unknown;
};

export function JsonPanel({ title, value }: JsonPanelProps) {
  return (
    <section className="panel json-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Debug</p>
          <h3>{title}</h3>
        </div>
      </div>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}
