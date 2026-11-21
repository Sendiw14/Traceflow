// SPDX-License-Identifier: Apache-2.0

// Package problem writes RFC 9457 problem+json responses per api/openapi.yaml.
package problem

import (
	"encoding/json"
	"net/http"
)

type body struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail,omitempty"`
	Code   string `json:"code"`
}

// Write sends a problem response. detail must be plain text without secrets.
func Write(w http.ResponseWriter, status int, code, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.Header().Set("Cache-Control", "private, no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body{
		Type:   "about:blank",
		Title:  http.StatusText(status),
		Status: status,
		Detail: detail,
		Code:   code,
	})
}
