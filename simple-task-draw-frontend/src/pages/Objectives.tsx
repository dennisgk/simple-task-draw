import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Stack } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { apiUrl, fetchJson } from "../api";
import type { Objective } from "../types";

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

export default function Objectives() {
  const params = useParams();
  const rawPath = params["*"] ?? "";
  const currentPath = normalizePath(decodeURIComponent(rawPath));
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchJson<Objective[]>(apiUrl("/api/objectives"))
      .then(setObjectives)
      .catch((err) => setError(err.message));
  }, []);

  const { objectiveAtPath, childSegments } = useMemo(() => {
    const relevantObjectives = showArchived
      ? objectives
      : objectives.filter((objective) => objective.status !== "archive");
    const normalized = currentPath ? `${currentPath}/` : "";
    const children = new Set<string>();
    let atPath: Objective | undefined;

    relevantObjectives.forEach((objective) => {
      if (objective.path === currentPath) {
        atPath = objective;
        return;
      }
      if (!currentPath || objective.path.startsWith(normalized)) {
        const remaining = objective.path.slice(normalized.length);
        if (!remaining) {
          return;
        }
        const [segment] = remaining.split("/");
        children.add(segment);
      }
    });

    return {
      objectiveAtPath: atPath,
      childSegments: Array.from(children).sort(),
    };
  }, [currentPath, objectives, showArchived]);

  const breadcrumbSegments = currentPath ? currentPath.split("/") : [];

  return (
    <Stack gap={4}>
      <div className="breadcrumb-box">
        <div className="text-muted mb-1">Current path</div>
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <Button as={Link} to="/objectives" size="sm" variant="outline-secondary">
            Root
          </Button>
          {breadcrumbSegments.map((segment, index) => {
            const route = breadcrumbSegments.slice(0, index + 1).join("/");
            return (
              <Button
                key={route}
                as={Link}
                to={`/objectives/${route}`}
                size="sm"
                variant="outline-secondary"
              >
                {segment}
              </Button>
            );
          })}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4">
        <Col lg={12}>
          <Card className="metric-card p-4">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <h3 className="mb-1">Objective overview</h3>
                <div className="text-muted">Navigate through the path tree and review detail.</div>
              </div>
              <Form.Check
                type="checkbox"
                id="show-archived"
                label="Show archived"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
            </div>

            {objectiveAtPath ? (
              <Card className="border-0 bg-white mt-4 p-3">
                <Stack gap={2}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="code-like">{objectiveAtPath.path}</div>
                    <Badge bg={objectiveAtPath.status === "active" ? "success" : "secondary"} className="badge-status">
                      {objectiveAtPath.status}
                    </Badge>
                  </div>
                  <div>{objectiveAtPath.prompt}</div>
                  <div className="d-flex gap-2">
                    <Button as={Link} to={`/practice/${objectiveAtPath.path}`} size="sm" variant="primary">
                      Practice
                    </Button>
                    <Button as={Link} to={`/progress/${objectiveAtPath.path}`} size="sm" variant="outline-primary">
                      Progress
                    </Button>
                    <Button as={Link} to={`/edit/${objectiveAtPath.path}`} size="sm" variant="outline-secondary">
                      Edit
                    </Button>
                  </div>
                </Stack>
              </Card>
            ) : (
              <div className="text-muted mt-4">No objective directly at this path yet.</div>
            )}

            <div className="mt-4">
              <h5 className="mb-2">Child paths</h5>
              <Stack gap={2}>
                {childSegments.map((segment) => {
                  const route = currentPath ? `${currentPath}/${segment}` : segment;
                  return (
                    <Button key={route} as={Link} to={`/objectives/${route}`} variant="outline-secondary">
                      {segment}
                    </Button>
                  );
                })}
                {childSegments.length === 0 && <div className="text-muted">No children under this path.</div>}
              </Stack>
            </div>
          </Card>
        </Col>
      </Row>
    </Stack>
  );
}
