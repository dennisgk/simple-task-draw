import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Row, Stack } from "react-bootstrap";
import { Link } from "react-router-dom";
import { apiUrl, fetchJson } from "../api";
import Heatmap from "../components/Heatmap";
import type { TelemetryOverview } from "../types";
import { formatDateTime, formatDuration } from "../utils";

export default function Home() {
  const [data, setData] = useState<TelemetryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<TelemetryOverview>(apiUrl("/api/telemetry/overview"))
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Stack gap={4}>
      <div className="hero-panel">
        <Row className="align-items-center">
          <Col md={8}>
            <h1 className="mb-2">Telemetry Command Center</h1>
            <p className="text-muted">
              A live readout of how much practice is happening, where the momentum is building, and which objectives are
              getting the most attention.
            </p>
          </Col>
          <Col md={4} className="text-md-end">
            <Button as={Link} to="/objectives" variant="primary">
              Explore Objectives
            </Button>
          </Col>
        </Row>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {data && (
        <>
          <Row className="g-4">
            <Col md={3}>
              <Card className="metric-card p-3">
                <div className="text-muted">Total submissions</div>
                <div className="metric-value">{data.total_submissions}</div>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="metric-card p-3">
                <div className="text-muted">Total objectives</div>
                <div className="metric-value">{data.total_objectives}</div>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="metric-card p-3">
                <div className="text-muted">Average rating</div>
                <div className="metric-value">{data.avg_rating.toFixed(2)}</div>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="metric-card p-3">
                <div className="text-muted">Total time spent</div>
                <div className="metric-value">{formatDuration(data.total_duration_ms)}</div>
              </Card>
            </Col>
          </Row>

          <Row className="g-4">
            <Col lg={7}>
              <Card className="metric-card p-4 h-100">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <h4 className="mb-1">Recent submissions</h4>
                    <div className="text-muted">Latest practice sessions across all objectives.</div>
                  </div>
                  {data.random_objective && (
                    <Button as={Link} to={`/practice/${data.random_objective.path}`} variant="outline-primary">
                      Practice random
                    </Button>
                  )}
                </div>
                <Stack gap={3}>
                  {data.recent_submissions.map((item) => (
                    <div key={item.id} className="border rounded-4 p-3 bg-white">
                      <div className="d-flex justify-content-between">
                        <div>
                          <div className="code-like">{item.objective_path}</div>
                          <div className="text-muted">{formatDateTime(item.created_at)}</div>
                        </div>
                        <div className="text-end">
                          <div className="fw-semibold">{item.avg_rating.toFixed(2)} / 5</div>
                          <div className="text-muted">{formatDuration(item.duration_ms)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.recent_submissions.length === 0 && (
                    <div className="text-muted">No submissions yet. Start a practice session to populate telemetry.</div>
                  )}
                </Stack>
              </Card>
            </Col>
            <Col lg={5}>
              <Card className="metric-card p-4 h-100">
                <h4 className="mb-3">Momentum heatmap</h4>
                <Heatmap data={data.heatmap} />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Stack>
  );
}
