import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Stack } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { apiUrl, fetchJson } from "../api";
import type { Objective, ProgressSummary } from "../types";

function normalizePath(path: string) {
  return path.replace(/^\/+|\/+$/g, "");
}

function renderMaskedText(text: string, reveal: boolean) {
  if (reveal) {
    return text.replace(/\$([^$]*)\$/g, "$1");
  }
  return text.replace(/\$[^$]*\$/g, "[hidden]");
}

function getNameFromPath(path: string) {
  const segments = normalizePath(path).split("/").filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

export default function Objectives() {
  const params = useParams();
  const rawPath = params["*"] ?? "";
  const currentPath = normalizePath(decodeURIComponent(rawPath));
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [flatten, setFlatten] = useState(false);
  const [practiceCounts, setPracticeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchJson<Objective[]>(apiUrl("/api/objectives"))
      .then(setObjectives)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const entries = await Promise.all(
          objectives.map(async (objective) => {
            const progress = await fetchJson<ProgressSummary>(apiUrl(`/api/objectives/${objective.id}/progress`));
            return [objective.id, progress.total_submissions] as const;
          }),
        );
        setPracticeCounts(Object.fromEntries(entries));
      } catch {
        // Keep objectives page usable even if telemetry calls fail.
        setPracticeCounts({});
      }
    };
    if (objectives.length > 0) {
      void loadCounts();
    } else {
      setPracticeCounts({});
    }
  }, [objectives]);

  const relevantObjectives = useMemo(
    () => (showArchived ? objectives : objectives.filter((objective) => objective.status !== "archive")),
    [objectives, showArchived],
  );

  const currentObjective = useMemo(
    () => relevantObjectives.find((objective) => objective.path === currentPath),
    [relevantObjectives, currentPath],
  );

  const { folders, files } = useMemo(() => {
    const normalizedPrefix = currentPath ? `${currentPath}/` : "";
    const folderSet = new Set<string>();
    const fileRows: Objective[] = [];

    relevantObjectives.forEach((objective) => {
      if (!currentPath || objective.path.startsWith(normalizedPrefix)) {
        const remaining = objective.path.slice(normalizedPrefix.length);
        if (!remaining) {
          return;
        }
        const segments = remaining.split("/");
        if (flatten || segments.length === 1) {
          fileRows.push(objective);
        }
        if (segments.length > 1) {
          folderSet.add(segments[0]);
        }
      }
    });

    return {
      folders: Array.from(folderSet).sort((a, b) => a.localeCompare(b)),
      files: fileRows.sort((a, b) => a.path.localeCompare(b.path)),
    };
  }, [currentPath, relevantObjectives, flatten]);

  const parentPath = currentPath.includes("/") ? currentPath.slice(0, currentPath.lastIndexOf("/")) : "";
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
        <Col lg={4}>
          <Card className="metric-card p-4 h-100">
            <h4 className="mb-3">Folders</h4>
            <Stack gap={2}>
              <Button as={Link} to={`/objectives/${parentPath}`} variant="outline-secondary" className="text-start">
                ..
              </Button>
              {folders.map((folder) => {
                const nextPath = currentPath ? `${currentPath}/${folder}` : folder;
                return (
                  <Button
                    key={nextPath}
                    as={Link}
                    to={`/objectives/${nextPath}`}
                    variant="outline-secondary"
                    className="text-start"
                  >
                    {folder}
                  </Button>
                );
              })}
              {folders.length === 0 && <div className="text-muted">No folders in this path.</div>}
            </Stack>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="metric-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div>
                <h3 className="mb-1">Objective overview</h3>
                <div className="text-muted">Files and objective details at this path.</div>
              </div>
              <Stack gap={1} className="align-items-end">
                <Form.Check
                  type="checkbox"
                  id="show-archived"
                  label="Show archived"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                />
                <Form.Check
                  type="checkbox"
                  id="show-hidden"
                  label="Show hidden"
                  checked={showHidden}
                  onChange={(event) => setShowHidden(event.target.checked)}
                />
                <Form.Check
                  type="checkbox"
                  id="flatten"
                  label="Flatten"
                  checked={flatten}
                  onChange={(event) => setFlatten(event.target.checked)}
                />
              </Stack>
            </div>

            {currentObjective && (
              <Card className="border-0 bg-white mt-4 p-3">
                <Stack gap={2}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="code-like">{currentObjective.path}</div>
                    <Badge bg={currentObjective.status === "active" ? "success" : "secondary"} className="badge-status">
                      {currentObjective.status}
                    </Badge>
                  </div>
                  <div>{renderMaskedText(currentObjective.prompt, showHidden)}</div>
                  <div className="d-flex gap-2">
                    <Button as={Link} to={`/practice/${currentObjective.path}`} size="sm" variant="primary">
                      Practice
                    </Button>
                    <Button as={Link} to={`/progress/${currentObjective.path}`} size="sm" variant="outline-primary">
                      Progress
                    </Button>
                    <Button as={Link} to={`/edit/${currentObjective.path}`} size="sm" variant="outline-secondary">
                      Edit
                    </Button>
                  </div>
                </Stack>
              </Card>
            )}

            <div className="mt-4">
              <h5 className="mb-2">Files at this path</h5>
              <Stack gap={2}>
                {files.map((objective) => (
                  <div key={objective.id} className="border rounded-3 p-3 bg-white d-flex justify-content-between gap-3">
                    <div>
                      <div className="code-like">
                        {flatten ? objective.path : getNameFromPath(objective.path)}
                      </div>
                      <div className="text-muted">{renderMaskedText(objective.prompt, showHidden)}</div>
                      <div className="text-muted small">Practiced: {practiceCounts[objective.id] ?? 0} times</div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <Badge bg={objective.status === "active" ? "success" : "secondary"} className="badge-status">
                        {objective.status}
                      </Badge>
                      <Button as={Link} to={`/practice/${objective.path}`} size="sm" variant="primary">
                        Practice
                      </Button>
                      <Button as={Link} to={`/objectives/${objective.path}`} size="sm" variant="outline-secondary">
                        Open
                      </Button>
                    </div>
                  </div>
                ))}
                {files.length === 0 && <div className="text-muted">No files in this path.</div>}
              </Stack>
            </div>
          </Card>
        </Col>
      </Row>
    </Stack>
  );
}
