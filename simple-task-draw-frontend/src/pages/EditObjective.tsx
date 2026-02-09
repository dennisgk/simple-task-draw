import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner, Stack } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { apiUrl, fetchJson } from "../api";
import type { Objective } from "../types";

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

export default function EditObjective() {
  const params = useParams();
  const rawPath = params["*"] ?? "";
  const objectivePath = normalizePath(decodeURIComponent(rawPath));
  const navigate = useNavigate();

  const [objective, setObjective] = useState<Objective | null>(null);
  const [path, setPath] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchJson<Objective>(apiUrl(`/api/objectives/by-path?path=${encodeURIComponent(objectivePath)}`))
      .then((data) => {
        setObjective(data);
        setPath(data.path);
        setPrompt(data.prompt);
        setStatus(data.status);
      })
      .catch((err) => setError(err.message));
  }, [objectivePath]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!objective) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await fetchJson<Objective>(apiUrl(`/api/objectives/${objective.id}`), {
        method: "PUT",
        body: JSON.stringify({ path, prompt, status }),
      });
      navigate(`/objectives/${updated.path}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!objective && !error) {
    return (
      <div className="text-center">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Card className="metric-card p-4">
      <h2 className="mb-3">Edit objective</h2>
      <p className="text-muted">Update the path, prompt, or status for this objective.</p>
      {error && <Alert variant="danger">{error}</Alert>}
      {objective && (
        <Form onSubmit={handleSubmit}>
          <Stack gap={3}>
            <Form.Group>
              <Form.Label>Path</Form.Label>
              <Form.Control value={path} onChange={(event) => setPath(event.target.value)} required />
            </Form.Group>
            <Form.Group>
              <Form.Label>Prompt</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                required
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Status</Form.Label>
              <Form.Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="active">Active</option>
                <option value="archive">Archive</option>
              </Form.Select>
            </Form.Group>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Update objective"}
            </Button>
          </Stack>
        </Form>
      )}
    </Card>
  );
}
