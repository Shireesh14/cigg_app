{{/*
Return chart name
*/}}
{{- define "cigg-app.name" -}}
{{- .Chart.Name -}}
{{- end }}

{{/*
Return full name
*/}}
{{- define "cigg-app.fullname" -}}
{{- .Release.Name }}-{{ .Chart.Name -}}
{{- end }}

{{/*
Common labels
*/}}
{{- define "cigg-app.labels" -}}
app.kubernetes.io/name: {{ include "cigg-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}