import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Form, Modal, Spinner, Stack } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import { apiUrl, fetchJson } from "../api";
import type { Objective } from "../types";

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

type DrawingState = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
};

export default function Practice() {
  const params = useParams();
  const rawPath = params["*"] ?? "";
  const objectivePath = normalizePath(decodeURIComponent(rawPath));
  const navigate = useNavigate();
  const startTimeRef = useRef<number>(Date.now());
  const [objective, setObjective] = useState<Objective | null>(null);
  const drawingRef = useRef<DrawingState>({ elements: [], appState: {}, files: {} });
  const [showModal, setShowModal] = useState(false);
  const [revealHidden, setRevealHidden] = useState(false);
  const [ratings, setRatings] = useState({
    clarity: 3,
    accuracy: 3,
    confidence: 3,
    speed: 3,
  });
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const renderPrompt = (prompt: string) => {
    if (revealHidden) {
      return prompt.replace(/\$([^$]*)\$/g, "$1");
    }
    return prompt.replace(/\$[^$]*\$/g, "[hidden]");
  };

  useEffect(() => {
    fetchJson<Objective>(apiUrl(`/api/objectives/by-path?path=${encodeURIComponent(objectivePath)}`))
      .then(setObjective)
      .catch((err) => setError(err.message));
  }, [objectivePath]);

  useEffect(() => {
    document.body.classList.add("practice-page");
    return () => {
      document.body.classList.remove("practice-page");
    };
  }, []);

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!objective) return;
    setIsSubmitting(true);
    setError(null);
    const durationMs = Date.now() - startTimeRef.current;

    try {
      await fetchJson(apiUrl(`/api/objectives/${objective.id}/submissions`), {
        method: "POST",
        body: JSON.stringify({
          duration_ms: durationMs,
          rating_clarity: ratings.clarity,
          rating_accuracy: ratings.accuracy,
          rating_confidence: ratings.confidence,
          rating_speed: ratings.speed,
          notes,
          excalidraw_data: drawingRef.current,
        }),
      });
      navigate(`/progress/${objective.path}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
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
    <Stack gap={3}>
      {error && <Alert variant="danger">{error}</Alert>}
      {objective && (
        <Card className="metric-card p-4">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h2 className="mb-2">{objective.path}</h2>
              <p className="text-muted mb-2">{renderPrompt(objective.prompt)}</p>
              <Button
                size="sm"
                variant={revealHidden ? "outline-warning" : "outline-secondary"}
                onClick={() => setRevealHidden((prev) => !prev)}
              >
                {revealHidden ? "Hide masked text" : "Reveal masked text"}
              </Button>
            </div>
            <Button onClick={handleOpenModal} variant="primary">
              Submit practice
            </Button>
          </div>
        </Card>
      )}

      <div className="excalidraw-wrapper">
        <Excalidraw
          theme="dark"
          onChange={(elements, appState, files) => {
            drawingRef.current = {
              elements: elements as unknown[],
              appState: appState as Record<string, unknown>,
              files: files as Record<string, unknown>,
            };
          }}
        />
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Rate this session</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Stack gap={3}>
            <Form.Group>
              <Form.Label>Clarity</Form.Label>
              <Form.Range
                min={1}
                max={5}
                value={ratings.clarity}
                onChange={(event) => setRatings((prev) => ({ ...prev, clarity: Number(event.target.value) }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Accuracy</Form.Label>
              <Form.Range
                min={1}
                max={5}
                value={ratings.accuracy}
                onChange={(event) => setRatings((prev) => ({ ...prev, accuracy: Number(event.target.value) }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Confidence</Form.Label>
              <Form.Range
                min={1}
                max={5}
                value={ratings.confidence}
                onChange={(event) => setRatings((prev) => ({ ...prev, confidence: Number(event.target.value) }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Speed</Form.Label>
              <Form.Range
                min={1}
                max={5}
                value={ratings.speed}
                onChange={(event) => setRatings((prev) => ({ ...prev, speed: Number(event.target.value) }))}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Notes (optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Form.Group>
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Stack>
  );
}
