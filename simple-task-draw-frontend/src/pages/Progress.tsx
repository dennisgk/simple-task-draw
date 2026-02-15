import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Modal,
  Row,
  Spinner,
  Stack,
  Table,
} from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { Excalidraw } from "@excalidraw/excalidraw";
import { apiUrl, fetchJson } from "../api";
import Heatmap from "../components/Heatmap";
import type { Objective, ProgressSummary, Submission } from "../types";
import { formatDateTime, formatDuration } from "../utils";

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

function renderMaskedText(text: string, reveal: boolean) {
  if (reveal) {
    return text.replace(/\$([^$]*)\$/g, "$1");
  }
  return text.replace(/\$[^$]*\$/g, "[hidden]");
}

type ExcalidrawPayload = {
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

export default function Progress() {
  const params = useParams();
  const rawPath = params["*"] ?? "";
  const objectivePath = normalizePath(decodeURIComponent(rawPath));
  const [objective, setObjective] = useState<Objective | null>(null);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [drawing, setDrawing] = useState<ExcalidrawPayload | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const objectiveData = await fetchJson<Objective>(
          apiUrl(`/api/objectives/by-path?path=${encodeURIComponent(objectivePath)}`),
        );
        setObjective(objectiveData);
        const progressData = await fetchJson<ProgressSummary>(
          apiUrl(`/api/objectives/${objectiveData.id}/progress`),
        );
        setSummary(progressData);
        const submissionData = await fetchJson<Submission[]>(
          apiUrl(`/api/objectives/${objectiveData.id}/submissions`),
        );
        setSubmissions(submissionData);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    load();
  }, [objectivePath]);

  const handleViewDrawing = async (submissionId: string) => {
    try {
      const payload = await fetchJson<ExcalidrawPayload>(apiUrl(`/api/submissions/${submissionId}/excalidraw`));
      setDrawing(payload);
      setShowModal(true);
    } catch (err) {
      setError((err as Error).message);
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
    <Stack gap={4}>
      {error && <Alert variant="danger">{error}</Alert>}
      {objective && summary && (
        <Card className="metric-card p-4">
          <Row className="align-items-center g-3">
            <Col lg={7}>
              <h2 className="mb-1">{objective.path}</h2>
              <p className="text-muted">{renderMaskedText(objective.prompt, showHidden)}</p>
              <div className="d-flex gap-2 mb-3">
                <Button as={Link} to={`/practice/${objective.path}`} size="sm" variant="primary">
                  Practice
                </Button>
                <Button size="sm" variant="outline-secondary" onClick={() => setShowHidden((prev) => !prev)}>
                  {showHidden ? "Hide masked text" : "Show masked text"}
                </Button>
              </div>
              <div className="d-flex flex-wrap gap-3">
                <Badge bg="primary">Submissions: {summary.total_submissions}</Badge>
                <Badge bg="secondary">Avg rating: {summary.avg_rating.toFixed(2)}</Badge>
                <Badge bg="info">Total time: {formatDuration(summary.total_duration_ms)}</Badge>
                <Badge bg="dark">Current streak: {summary.current_streak_days} days</Badge>
              </div>
            </Col>
            <Col lg={5}>
              <Heatmap data={summary.heatmap} />
            </Col>
          </Row>
        </Card>
      )}

      <Card className="metric-card p-4">
        <h4 className="mb-3">Submissions</h4>
        <Table responsive hover className="align-middle">
          <thead>
            <tr>
              <th>Date</th>
              <th>Duration</th>
              <th>Ratings</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr key={submission.id}>
                <td>{formatDateTime(submission.created_at)}</td>
                <td>{formatDuration(submission.duration_ms)}</td>
                <td>
                  {submission.rating_clarity}/5 | {submission.rating_accuracy}/5 | {submission.rating_confidence}/5 |
                  {submission.rating_speed}/5
                </td>
                <td>{submission.notes ? renderMaskedText(submission.notes, showHidden) : "--"}</td>
                <td>
                  <Button size="sm" variant="outline-primary" onClick={() => handleViewDrawing(submission.id)}>
                    View drawing
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {submissions.length === 0 && <div className="text-muted">No submissions yet.</div>}
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Submission drawing</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ height: "70vh" }}>
          {drawing && (
            <Excalidraw
              theme="dark"
              initialData={{
                elements: drawing.elements ?? [],
                appState: {
                  viewModeEnabled: true,
                  zenModeEnabled: true,
                  ...(() => {
                    if (!drawing.appState) return {};
                    const { collaborators, ...rest } = drawing.appState;
                    return rest;
                  })(),
                },
                files: drawing.files ?? {},
              }}
              viewModeEnabled
            />
          )}
        </Modal.Body>
      </Modal>
    </Stack>
  );
}
