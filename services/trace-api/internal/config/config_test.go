// SPDX-License-Identifier: Apache-2.0

package config

import (
	"strings"
	"testing"
)

const goodToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" // gitleaks:allow test fixture, not a secret

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func valid() map[string]string {
	return map[string]string{
		"TRACEFLOW_PROFILE":       "local-dev",
		"TRACEFLOW_DATABASE_URL":  "postgres://u:secretpw@db:5432/x",
		"TRACEFLOW_SERVICE_TOKEN": goodToken,
	}
}

func TestLoad(t *testing.T) {
	cases := []struct {
		name    string
		mutate  func(map[string]string)
		wantErr string
	}{
		{"valid", func(map[string]string) {}, ""},
		{"missing profile", func(m map[string]string) { delete(m, "TRACEFLOW_PROFILE") }, "TRACEFLOW_PROFILE is required"},
		{"unknown profile", func(m map[string]string) { m["TRACEFLOW_PROFILE"] = "prod" }, "is not one of"},
		{"missing db", func(m map[string]string) { delete(m, "TRACEFLOW_DATABASE_URL") }, "TRACEFLOW_DATABASE_URL is required"},
		{"short token", func(m map[string]string) { m["TRACEFLOW_SERVICE_TOKEN"] = "abc" }, "TRACEFLOW_SERVICE_TOKEN"},
		{"demo with ingest", func(m map[string]string) {
			m["TRACEFLOW_PROFILE"] = "public-demo"
			m["TRACEFLOW_INGEST_ADDR"] = ":4318"
		}, "must not be set in public-demo"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			m := valid()
			tc.mutate(m)
			c, err := Load(env(m))
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if c.QueryAddr != ":8080" {
					t.Fatalf("default QueryAddr = %q", c.QueryAddr)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("error = %v, want containing %q", err, tc.wantErr)
			}
		})
	}
}

func TestRedactedHidesSecrets(t *testing.T) {
	c, err := Load(env(valid()))
	if err != nil {
		t.Fatal(err)
	}
	r := c.Redacted()
	if strings.Contains(r, "secretpw") || strings.Contains(r, goodToken) {
		t.Fatalf("Redacted leaked a secret: %s", r)
	}
}
