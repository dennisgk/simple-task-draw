import { useState } from "react";
import { Alert, Button, Card, Form, Stack } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { apiUrl, fetchJson } from "../api";
import type { Objective } from "../types";

export default function CreateObjective() {
  const navigate = useNavigate();
  const [path, setPath] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("active");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const objective = await fetchJson<Objective>(apiUrl("/api/objectives"), {
        method: "POST",
        body: JSON.stringify({ path, prompt, status }),
      });
      navigate(`/objectives/${objective.path}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="metric-card p-4">
      <h2 className="mb-3">Create objective</h2>
      <p className="text-muted">Define a new practice objective with a path and prompt.</p>
      {error && <Alert variant="danger">{error}</Alert>}
      <Form onSubmit={handleSubmit}>
        <Stack gap={3}>
          <Form.Group>
            <Form.Label>Path</Form.Label>
            <Form.Control
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="e.g. math/algebra/quadratics"
              required
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Prompt</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the task you want to practice"
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
            {isSaving ? "Saving..." : "Create objective"}
          </Button>
        </Stack>
      </Form>
    </Card>
  );
}
