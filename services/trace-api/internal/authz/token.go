// SPDX-License-Identifier: Apache-2.0

// Package authz enforces the BFF→trace-api service token (ADR-0005).
package authz

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/Sendiw14/Traceflow/services/trace-api/internal/problem"
)

// RequireServiceToken rejects requests without `Authorization: Bearer <token>` matching token.
func RequireServiceToken(token string, next http.Handler) http.Handler {
	want := []byte(token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || subtle.ConstantTimeCompare([]byte(got), want) != 1 {
			problem.Write(w, http.StatusUnauthorized, "unauthorized", "Missing or invalid service token.")
			return
		}
		next.ServeHTTP(w, r)
	})
}
