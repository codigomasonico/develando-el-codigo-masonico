& {
    $ErrorActionPreference = "Stop"

    $Project = "D:\01 Logia\_Podcast\1000 - Desarrollo\04 - Producción\web"
    $ReportDir = Join-Path $Project "reports"
    $Phone = "528115774235"
    $QuestionDirect = "¿Qué es la masonería?"
    $QuestionAI = "¿Cuándo surgió la masonería?"
    $BaseUrl = "https://develandoelcodigomasonico.com"
    $RunId = Get-Date -Format "yyMMdd-HHmmss"
    $R = Join-Path $ReportDir "$RunId-PROD-diagnostico-forense-whatsapp.txt"
    $TempDir = Join-Path $ReportDir ".diag-$RunId"

    New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
    New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
    Set-Location -LiteralPath $Project

    function Add-Log([string]$Text = "") {
        Add-Content -LiteralPath $R -Value $Text -Encoding UTF8
    }

    function Add-Section([string]$Title) {
        Add-Log ""
        Add-Log ("=" * 78)
        Add-Log $Title
        Add-Log ("=" * 78)
    }

    function Mask-Phone([string]$Value) {
        $v = [string]$Value
        if ($v.Length -le 4) { return $v }
        return ("*" * ($v.Length - 4)) + $v.Substring($v.Length - 4)
    }

    function Mask-Id([string]$Value) {
        $v = [string]$Value
        if ($v.Length -le 10) { return $v }
        return $v.Substring(0, 7) + "..." + $v.Substring($v.Length - 4)
    }

    function Run-Netlify([string[]]$CliArgs) {
        $old = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $out = (& npx --no-install netlify @CliArgs 2>&1 | Out-String)
        $code = $LASTEXITCODE
        $ErrorActionPreference = $old
        return [pscustomobject]@{ Code = $code; Out = $out }
    }

    function Clean-NetlifyValue([string]$Raw) {
        $lines = @($Raw -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object {
            $_ -and
            $_ -notmatch '^npm warn' -and
            $_ -notmatch '^Netlify CLI' -and
            $_ -notmatch '^Need to install'
        })
        if ($lines.Count -eq 0) { return "" }
        $v = [string]$lines[-1]
        if ($v -match 'No value set|not found|undefined|null|write-only|cannot be read|not available') { return "" }
        return $v.Trim()
    }

    function Get-NetlifyEnvValue([string]$Name) {
        $res = Run-Netlify @("env:get", $Name, "--context", "production", "--scope", "functions")
        if ($res.Code -ne 0) { return "" }
        return Clean-NetlifyValue $res.Out
    }

    function Get-BlobJson([string]$Store, [string]$Key, [string]$Label) {
        $safe = ($Label -replace '[^A-Za-z0-9_-]', '_')
        $path = Join-Path $TempDir "$safe.json"
        $res = Run-Netlify @("blobs:get", $Store, $Key, "--output", $path)
        if ($res.Code -ne 0 -or -not (Test-Path -LiteralPath $path)) {
            return [pscustomobject]@{ Exists = $false; Data = $null; Error = ($res.Out.Trim()) }
        }
        $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        try {
            $data = $raw | ConvertFrom-Json
            return [pscustomobject]@{ Exists = $true; Data = $data; Error = "" }
        }
        catch {
            return [pscustomobject]@{ Exists = $true; Data = $null; Error = "JSON inválido: $($_.Exception.Message)" }
        }
    }

    function Invoke-JsonHttp([string]$Url, [string]$Method, [hashtable]$Headers, [string]$Body, [int]$TimeoutSeconds = 45) {
        Add-Type -AssemblyName System.Net.Http
        $http = [System.Net.Http.HttpClient]::new()
        $http.Timeout = [TimeSpan]::FromSeconds($TimeoutSeconds)
        $httpMethod = [System.Net.Http.HttpMethod]::new($Method.ToUpperInvariant())
        $request = [System.Net.Http.HttpRequestMessage]::new($httpMethod, $Url)
        foreach ($k in $Headers.Keys) {
            if ($k -ieq "Content-Type") { continue }
            [void]$request.Headers.TryAddWithoutValidation([string]$k, [string]$Headers[$k])
        }
        if ($Method -ne "Get") {
            $request.Content = [System.Net.Http.StringContent]::new(
                [string]$Body,
                [System.Text.Encoding]::UTF8,
                "application/json"
            )
        }
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $result = $null
        try {
            $resp = $http.SendAsync($request).GetAwaiter().GetResult()
            $raw = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            $sw.Stop()
            $json = $null
            try { if ($raw) { $json = $raw | ConvertFrom-Json } } catch {}
            $result = [pscustomobject]@{
                Ok = $resp.IsSuccessStatusCode
                Status = [int]$resp.StatusCode
                Reason = [string]$resp.ReasonPhrase
                Ms = [int64]$sw.ElapsedMilliseconds
                Raw = [string]$raw
                Json = $json
                Error = ""
            }
        }
        catch {
            $sw.Stop()
            $result = [pscustomobject]@{
                Ok = $false
                Status = 0
                Reason = "EXCEPTION"
                Ms = [int64]$sw.ElapsedMilliseconds
                Raw = ""
                Json = $null
                Error = $_.Exception.Message
            }
        }
        $request.Dispose()
        $http.Dispose()
        return $result
    }

    function Hmac-Hex([string]$Secret, [string]$Text) {
        $h = [System.Security.Cryptography.HMACSHA256]::new([System.Text.Encoding]::UTF8.GetBytes($Secret))
        $bytes = $h.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Text))
        $h.Dispose()
        return ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
    }

    function Invoke-Account([hashtable]$Payload, [string]$Secret, [string]$Url) {
        $raw = $Payload | ConvertTo-Json -Depth 10 -Compress
        $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
        $sig = Hmac-Hex $Secret "$ts.$raw"
        return Invoke-JsonHttp -Url $Url -Method "Post" -Headers @{
            "X-Cartes-Timestamp" = $ts
            "X-Cartes-Signature" = $sig
            "Content-Type" = "application/json"
        } -Body $raw -TimeoutSeconds 12
    }

    function Short-Error([string]$Text, [int]$Max = 500) {
        $t = [string]$Text
        if ($t.Length -le $Max) { return $t }
        return $t.Substring(0, $Max) + "..."
    }

    $IdentityOk = $false
    $AccountStateOk = $false
    $ReserveReleaseOk = $false
    $CoreDirectOk = $false
    $CoreAiOk = $false
    $CoreHistoryOk = $false
    $MetaAccepted = $false
    $HandlerProbeRun = $false
    $HandlerProbeOk = $false
    $HandlerProbeFailed = $false
    $HandlerProbeLogFound = $false
    $UserId = ""
    $CurrentUsage = $null
    $CoreAnswer = ""
    $WebIdentityCount = 0
    $LegacySubscription = $null
    $ExistingConversationRequestId = ""

    try {
        Set-Content -LiteralPath $R -Value "CARTES - DIAGNÓSTICO FORENSE INTEGRAL DE WHATSAPP EN PRODUCCIÓN" -Encoding UTF8
        Add-Log "Inicio: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
        Add-Log "Teléfono de prueba: $(Mask-Phone $Phone)"
        Add-Log "Pregunta IA: $QuestionAI"
        Add-Log "Política: no deploy, no cambios de variables, no cambios de pagos, no cancelaciones."
        Add-Log "Únicas acciones con estado: reserva sintética inmediatamente liberada y un mensaje técnico directo por Meta, solo si las etapas previas permiten ejecutarlas."

        Add-Section "1. SITIO NETLIFY Y CONTEXTO"
        $status = Run-Netlify @("status")
        Add-Log "netlify status exit code: $($status.Code)"
        if ($status.Code -ne 0) { throw "Netlify CLI no pudo leer el sitio vinculado." }
        $statusText = $status.Out
        $prodSiteSignal = $statusText -match 'develandoelcodigomasonico'
        Add-Log "Sitio contiene señal de Producción develandoelcodigomasonico: $prodSiteSignal"
        if (-not $prodSiteSignal) { throw "La carpeta actual no parece vinculada al sitio de Producción esperado. Diagnóstico detenido sin tocar Producción." }

        if (Test-Path -LiteralPath ".netlify\state.json") {
            try {
                $state = Get-Content -LiteralPath ".netlify\state.json" -Raw | ConvertFrom-Json
                Add-Log "Netlify siteId: $(Mask-Id ([string]$state.siteId))"
            } catch { Add-Log "No se pudo interpretar .netlify/state.json." }
        }

        Add-Section "2. INVENTARIO DE VARIABLES DE PRODUCCIÓN, SIN IMPRIMIR SECRETOS"
        $envList = Run-Netlify @("env:list", "--context", "production", "--scope", "functions", "--json")
        Add-Log "env:list production/functions exit code: $($envList.Code)"
        $required = @(
            "CARTES_API_URL",
            "CARTES_ACCOUNT_API_URL",
            "CARTES_INTERNAL_SECRET",
            "OPENAI_API_KEY",
            "WHATSAPP_ACCESS_TOKEN",
            "WHATSAPP_PHONE_NUMBER_ID",
            "WHATSAPP_GRAPH_VERSION",
            "WHATSAPP_PUBLIC_NUMBER",
            "META_APP_SECRET"
        )
        foreach ($name in $required) {
            $present = $envList.Out -match [regex]::Escape($name)
            Add-Log ("{0}: {1}" -f $name, $(if ($present) { "PRESENTE" } else { "NO DETECTADA EN production/functions" }))
        }

        $CartesApiUrl = Get-NetlifyEnvValue "CARTES_API_URL"
        if (-not $CartesApiUrl) { $CartesApiUrl = "$BaseUrl/.netlify/functions/guia-masonico" }
        $AccountApiConfigured = Get-NetlifyEnvValue "CARTES_ACCOUNT_API_URL"
        if (-not $AccountApiConfigured) { $AccountApiConfigured = "$BaseUrl/.netlify/functions/cartes-account" }
        Add-Log "CARTES_API_URL efectivo para el diagnóstico: $CartesApiUrl"
        Add-Log "CARTES_ACCOUNT_API_URL configurado/fallback: $AccountApiConfigured"

        Add-Section "3. HUELLA DEL CÓDIGO LOCAL QUE REPRESENTA PRODUCCIÓN"
        $files = @(
            "netlify\functions\cartes-whatsapp.mjs",
            "channels\whatsapp\functions\cartes-whatsapp.mjs",
            "channels\whatsapp\functions\lib-cartes-account-client.mjs",
            "channels\whatsapp\functions\lib-uso-unificado-cartes.mjs",
            "channels\whatsapp\functions\lib-cartes-core-client.mjs",
            "channels\whatsapp\functions\lib-cartes.mjs",
            "core\ai\guia-masonico.mjs",
            "core\ai\cartes-account.mjs"
        )
        foreach ($f in $files) {
            if (Test-Path -LiteralPath $f) {
                $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $f).Hash
                Add-Log "$f | SHA256=$hash"
            } else {
                Add-Log "$f | FALTA"
            }
        }

        $waSource = Get-Content -LiteralPath "channels\whatsapp\functions\cartes-whatsapp.mjs" -Raw
        $acctSource = Get-Content -LiteralPath "channels\whatsapp\functions\lib-cartes-account-client.mjs" -Raw
        Add-Log "Código contiene procesarConsultaCartesConLimite: $($waSource.Contains('procesarConsultaCartesConLimite'))"
        Add-Log "Código contiene enviarTextoEnPartes: $($waSource.Contains('enviarTextoEnPartes'))"
        Add-Log "Código contiene fallback ERROR_RESPUESTA_GENERAL: $($waSource.Contains('ERROR_RESPUESTA_GENERAL'))"
        $iDeploy = $acctSource.IndexOf('process.env.DEPLOY_PRIME_URL')
        $iConfigured = $acctSource.IndexOf('process.env.CARTES_ACCOUNT_API_URL')
        if ($iDeploy -ge 0 -and $iConfigured -ge 0 -and $iDeploy -lt $iConfigured) {
            Add-Log "POLÍTICA ACCOUNT URL: DEPLOY_PRIME_URL tiene prioridad sobre CARTES_ACCOUNT_API_URL en este código."
        } else {
            Add-Log "POLÍTICA ACCOUNT URL: CARTES_ACCOUNT_API_URL no está subordinada a DEPLOY_PRIME_URL según el orden detectado."
        }

        Add-Section "4. IDENTIDAD CENTRAL REAL DEL WHATSAPP, LECTURA DIRECTA DE BLOBS"
        $identityKey = "account-v1:identity:whatsapp:$Phone"
        $identityBlob = Get-BlobJson "cartes-core" $identityKey "identity"
        Add-Log "Clave de identidad consultada: account-v1:identity:whatsapp:$(Mask-Phone $Phone)"
        Add-Log "Existe: $($identityBlob.Exists)"
        if (-not $identityBlob.Exists -or $null -eq $identityBlob.Data) {
            Add-Log "Error/ausencia: $(Short-Error $identityBlob.Error)"
            throw "No existe una identidad central legible para el WhatsApp real."
        }
        $UserId = [string]$identityBlob.Data.user_id
        $IdentityOk = $UserId -match '^usr_[a-f0-9]{32}$'
        Add-Log "user_id válido: $IdentityOk ($(Mask-Id $UserId))"
        Add-Log "identity_type: $($identityBlob.Data.identity_type)"
        Add-Log "identity_value normalizado: $(Mask-Phone ([string]$identityBlob.Data.identity_value))"
        if (-not $IdentityOk) { throw "La identidad WhatsApp apunta a un user_id inválido." }

        $userBlob = Get-BlobJson "cartes-core" "account-v1:user:$UserId" "user"
        Add-Log "Registro user central existe: $($userBlob.Exists)"
        if ($userBlob.Exists -and $null -ne $userBlob.Data) {
            $waIds = @($userBlob.Data.identities.whatsapp)
            $webIds = @($userBlob.Data.identities.web)
            $WebIdentityCount = $webIds.Count
            Add-Log "Identidades WhatsApp asociadas: $($waIds.Count)"
            Add-Log "Identidades Web asociadas al MISMO user_id: $WebIdentityCount"
            Add-Log "Web y WhatsApp vinculados a la misma cuenta: $(if ($WebIdentityCount -gt 0) { 'SI' } else { 'NO' })"
        } else {
            Add-Log "ALERTA: existe pointer de identidad pero falta account-v1:user:$UserId."
        }

        Add-Section "5. PLAN, SUSCRIPCIÓN Y USO CENTRAL DEL USUARIO REAL"
        $planBlob = Get-BlobJson "cartes-core" "plan-v1:$UserId" "plan"
        $subBlob = Get-BlobJson "cartes-core" "subscription-v1:$UserId" "subscription-central"
        $period = Get-Date -Format "yyyy-MM"
        $usageBlob = Get-BlobJson "cartes-core" "usage-v2:${period}:$UserId" "usage"
        $conversationBlob = Get-BlobJson "cartes-core" "conversation-v1:$UserId" "conversation"

        Add-Log "Plan central blob existe: $($planBlob.Exists)"
        if ($planBlob.Exists -and $null -ne $planBlob.Data) { Add-Log "Plan central: $($planBlob.Data.plan) | source=$($planBlob.Data.source)" }
        Add-Log "Suscripción central blob existe: $($subBlob.Exists)"
        if ($subBlob.Exists -and $null -ne $subBlob.Data) {
            Add-Log "Suscripción central: status=$($subBlob.Data.status) source=$($subBlob.Data.source) renovacion_cancelada=$($subBlob.Data.renovacion_cancelada)"
        }
        Add-Log "Usage central $period existe: $($usageBlob.Exists)"
        if ($usageBlob.Exists -and $null -ne $usageBlob.Data) {
            $allQueries = @($usageBlob.Data.consultas)
            $pending = @($allQueries | Where-Object { $_.estado -eq 'pendiente' })
            $complete = @($allQueries | Where-Object { $_.estado -eq 'completada' })
            Add-Log "Consultas registradas en blob: total=$($allQueries.Count), completadas=$($complete.Count), pendientes=$($pending.Count)"
            foreach ($p in $pending | Select-Object -Last 5) {
                Add-Log "Pendiente: request_id=$(Mask-Id ([string]$p.request_id)) reserved_at=$($p.reserved_at) channel=$($p.channel)"
            }
        }
        Add-Log "Conversación central existe: $($conversationBlob.Exists)"
        if ($conversationBlob.Exists -and $null -ne $conversationBlob.Data) {
            $exchanges = @($conversationBlob.Data.exchanges)
            Add-Log "Intercambios guardados: $($exchanges.Count)"
            $existingIds = @($exchanges | ForEach-Object { [string]$_.request_id } | Where-Object { $_ })
            if ($existingIds.Count -gt 0) {
                $ExistingConversationRequestId = [string]$existingIds[-1]
                Add-Log "Existe request_id reutilizable para prueba de memoria sin escritura: SI ($(Mask-Id $ExistingConversationRequestId))"
            } else {
                Add-Log "Existe request_id reutilizable para prueba de memoria sin escritura: NO"
            }
        }

        Add-Section "6. ESTADO LEGACY DE WHATSAPP / MERCADO PAGO, SOLO LECTURA"
        $legacyUser = Get-BlobJson "cartes-whatsapp" "mp-v3:suscripcion-user:production:$UserId" "legacy-sub-user"
        $legacyPhone = Get-BlobJson "cartes-whatsapp" "mp-v3:suscripcion-telefono:production:$Phone" "legacy-sub-phone"
        $phone521 = if ($Phone.StartsWith('52') -and $Phone.Length -eq 12) { "521$($Phone.Substring(2))" } else { "" }
        $legacy521 = if ($phone521) { Get-BlobJson "cartes-whatsapp" "mp-v3:suscripcion-telefono:production:$phone521" "legacy-sub-phone521" } else { $null }
        Add-Log "Legacy por user_id existe: $($legacyUser.Exists)"
        Add-Log "Legacy por teléfono 52 existe: $($legacyPhone.Exists)"
        if ($null -ne $legacy521) { Add-Log "Legacy por variante 521 existe: $($legacy521.Exists)" }

        if ($legacyUser.Exists -and $null -ne $legacyUser.Data) { $LegacySubscription = $legacyUser.Data }
        elseif ($legacyPhone.Exists -and $null -ne $legacyPhone.Data) { $LegacySubscription = $legacyPhone.Data }
        elseif ($null -ne $legacy521 -and $legacy521.Exists -and $null -ne $legacy521.Data) { $LegacySubscription = $legacy521.Data }

        if ($null -ne $LegacySubscription) {
            Add-Log "Legacy status=$($LegacySubscription.status) preapproval_id=$(Mask-Id ([string]$LegacySubscription.preapproval_id)) user_id=$(Mask-Id ([string]$LegacySubscription.user_id))"
            if ($LegacySubscription.preapproval_id) {
                Add-Log "Existe preapproval_id legacy, pero NO se consulta Mercado Pago remotamente en este diagnóstico. No hay evidencia que justifique tocar ese tramo."
            }
        } else {
            Add-Log "No hay suscripción legacy para este usuario/teléfono."
        }


        Add-Section "7. CARTES ACCOUNT CON EL USUARIO REAL, HMAC Y SOLO LECTURA"
        $internalSecret = Get-NetlifyEnvValue "CARTES_INTERNAL_SECRET"
        if (-not $internalSecret) {
            Add-Log "CARTES_INTERNAL_SECRET no fue legible por CLI. No se puede firmar la prueba HMAC real desde esta consola."
        } else {
            $accountUrl = "$BaseUrl/.netlify/functions/cartes-account"
            $stateResp = Invoke-Account @{ action = "state"; user_id = $UserId; plan = $null } $internalSecret $accountUrl
            Add-Log "Account state: HTTP=$($stateResp.Status) ms=$($stateResp.Ms)"
            if ($stateResp.Ok -and $null -ne $stateResp.Json) {
                $AccountStateOk = $true
                $CurrentUsage = $stateResp.Json
                Add-Log "Account state real: plan=$($CurrentUsage.plan) periodo=$($CurrentUsage.periodo) limite=$($CurrentUsage.limite) usadas=$($CurrentUsage.usadas) disponibles=$($CurrentUsage.disponibles)"
            } else {
                Add-Log "Account state error: $(Short-Error ($stateResp.Error + ' ' + $stateResp.Raw))"
            }

            $subResp = Invoke-Account @{ action = "subscription_get"; user_id = $UserId } $internalSecret $accountUrl
            Add-Log "Account subscription_get: HTTP=$($subResp.Status) ms=$($subResp.Ms)"
            if (-not $subResp.Ok) { Add-Log "subscription_get error: $(Short-Error ($subResp.Error + ' ' + $subResp.Raw))" }

            if ($AccountStateOk -and [int]$CurrentUsage.disponibles -gt 1) {
                Add-Section "8. RESERVA Y LIBERACIÓN SINTÉTICA DEL MISMO CAMINO QUE WHATSAPP"
                $diagRequest = "diag-whatsapp-$RunId"
                $reserve = Invoke-Account @{ action = "reserve"; user_id = $UserId; plan = $null; request_id = $diagRequest; channel = "whatsapp" } $internalSecret $accountUrl
                Add-Log "Reserve: HTTP=$($reserve.Status) ms=$($reserve.Ms)"
                $reserved = $false
                $reservePeriod = ""
                if ($reserve.Ok -and $null -ne $reserve.Json) {
                    Add-Log "Reserve result: permitida=$($reserve.Json.permitida) duplicada=$($reserve.Json.duplicada) periodo=$($reserve.Json.periodo) usadas=$($reserve.Json.usadas) disponibles=$($reserve.Json.disponibles)"
                    $reserved = [bool]$reserve.Json.permitida
                    $reservePeriod = [string]$reserve.Json.periodo
                } else {
                    Add-Log "Reserve error: $(Short-Error ($reserve.Error + ' ' + $reserve.Raw))"
                }

                if ($reserved -and $reservePeriod) {
                    $release = Invoke-Account @{ action = "release"; user_id = $UserId; periodo = $reservePeriod; request_id = $diagRequest } $internalSecret $accountUrl
                    Add-Log "Release: HTTP=$($release.Status) ms=$($release.Ms) updated=$($release.Json.updated)"
                    if ($release.Ok -and [bool]$release.Json.updated) {
                        $ReserveReleaseOk = $true
                    } else {
                        Start-Sleep -Milliseconds 500
                        $release2 = Invoke-Account @{ action = "release"; user_id = $UserId; periodo = $reservePeriod; request_id = $diagRequest } $internalSecret $accountUrl
                        Add-Log "Release retry: HTTP=$($release2.Status) ms=$($release2.Ms) updated=$($release2.Json.updated)"
                        $ReserveReleaseOk = $release2.Ok -and [bool]$release2.Json.updated
                    }
                } elseif ($reserve.Ok -and -not [bool]$reserve.Json.permitida) {
                    Add-Log "La reserva no fue permitida; no se modificó consumo."
                }
            } else {
                Add-Section "8. RESERVA/LIBERACIÓN SINTÉTICA"
                Add-Log "Omitida porque Account state no pasó o no hay al menos 2 consultas disponibles. Se preserva el último cupo del usuario."
            }
        }

        Add-Section "9. CORE, COMPARACIÓN DIRECTA VS RUTA IA"
        $payloadDirect = @{ question = $QuestionDirect } | ConvertTo-Json -Depth 10 -Compress
        $coreDirect = Invoke-JsonHttp -Url $CartesApiUrl -Method "Post" -Headers @{ "Content-Type" = "application/json" } -Body $payloadDirect -TimeoutSeconds 45
        Add-Log "Core pregunta directa: HTTP=$($coreDirect.Status) ms=$($coreDirect.Ms)"
        if ($coreDirect.Ok -and $null -ne $coreDirect.Json -and $coreDirect.Json.answer) {
            $CoreDirectOk = $true
            Add-Log "route=$($coreDirect.Json.meta.route) answerChars=$(([string]$coreDirect.Json.answer).Length) promptVersion=$($coreDirect.Json.meta.promptVersion)"
        } else { Add-Log "Core directa error: $(Short-Error ($coreDirect.Error + ' ' + $coreDirect.Raw))" }

        $payloadAi = @{ question = $QuestionAI } | ConvertTo-Json -Depth 10 -Compress
        $coreAi = Invoke-JsonHttp -Url $CartesApiUrl -Method "Post" -Headers @{ "Content-Type" = "application/json" } -Body $payloadAi -TimeoutSeconds 45
        Add-Log "Core IA sin contexto de usuario: HTTP=$($coreAi.Status) ms=$($coreAi.Ms)"
        if ($coreAi.Ok -and $null -ne $coreAi.Json -and $coreAi.Json.answer) {
            $CoreAiOk = $true
            Add-Log "route=$($coreAi.Json.meta.route) answerChars=$(([string]$coreAi.Json.answer).Length) promptVersion=$($coreAi.Json.meta.promptVersion)"
        } else { Add-Log "Core IA error: $(Short-Error ($coreAi.Error + ' ' + $coreAi.Raw))" }

        Add-Section "10. CORE CON LA MEMORIA REAL DEL USUARIO"
        $history = @()
        if ($conversationBlob.Exists -and $null -ne $conversationBlob.Data) {
            foreach ($exchange in @($conversationBlob.Data.exchanges)) {
                foreach ($m in @($exchange.messages)) {
                    $role = [string]$m.role
                    $content = [string]$m.content
                    if (($role -eq 'user' -or $role -eq 'assistant') -and $content) {
                        $history += @{ role = $role; content = $content }
                    }
                }
            }
        }
        if ($history.Count -gt 20) { $history = @($history | Select-Object -Last 20) }
        Add-Log "Mensajes disponibles en historial central: $($history.Count)"

        if ($ExistingConversationRequestId) {
            Add-Log "Modo de prueba: user_id REAL + request_id ya existente. Esto obliga a guia-masonico a cargar la memoria central y evita agregar un nuevo intercambio por deduplicación de request_id."
            $contextPayloadObj = @{
                question = $QuestionAI
                history = @()
                client = @{
                    channel = "whatsapp"
                    external_user_id = $Phone
                    user_id = $UserId
                    request_id = $ExistingConversationRequestId
                }
            }
        } else {
            Add-Log "Modo de prueba alterno: historial central explícito + user_id nulo. No se escribe memoria porque no hay user_id válido."
            $contextPayloadObj = @{
                question = $QuestionAI
                history = $history
                client = @{
                    channel = "whatsapp"
                    external_user_id = $Phone
                    user_id = $null
                    request_id = "diag-context-$RunId"
                }
            }
        }

        $contextPayload = $contextPayloadObj | ConvertTo-Json -Depth 12 -Compress
        $coreContext = Invoke-JsonHttp -Url $CartesApiUrl -Method "Post" -Headers @{ "Content-Type" = "application/json" } -Body $contextPayload -TimeoutSeconds 35
        Add-Log "Core IA con memoria WhatsApp real, timeout idéntico al cliente WhatsApp 35s: HTTP=$($coreContext.Status) ms=$($coreContext.Ms)"
        if ($coreContext.Ok -and $null -ne $coreContext.Json -and $coreContext.Json.answer) {
            $CoreHistoryOk = $true
            $CoreAnswer = [string]$coreContext.Json.answer
            Add-Log "route=$($coreContext.Json.meta.route) answerChars=$($CoreAnswer.Length) promptVersion=$($coreContext.Json.meta.promptVersion)"
        } else {
            Add-Log "Core memoria real error: $(Short-Error ($coreContext.Error + ' ' + $coreContext.Raw))"
        }


        Add-Section "11. META GRAPH API, PAYLOAD DEL SENDER NORMAL DE WHATSAPP"
        $waToken = Get-NetlifyEnvValue "WHATSAPP_ACCESS_TOKEN"
        $waPhoneId = Get-NetlifyEnvValue "WHATSAPP_PHONE_NUMBER_ID"
        $waGraph = Get-NetlifyEnvValue "WHATSAPP_GRAPH_VERSION"
        if (-not $waGraph) { $waGraph = "v25.0" }
        if (-not $waToken -or -not $waPhoneId) {
            Add-Log "Token o Phone Number ID no fueron legibles por CLI; envío directo Meta omitido."
        } elseif (-not $CoreHistoryOk) {
            Add-Log "Core con contexto no pasó; no se enviará mensaje técnico a Meta."
        } else {
            $maxAnswer = [Math]::Min(3000, $CoreAnswer.Length)
            $diagText = "[DIAG CARTES PROD] Sender normal preview_url=true. $RunId`n`n" + $CoreAnswer.Substring(0, $maxAnswer)
            $metaPayload = @{
                messaging_product = "whatsapp"
                recipient_type = "individual"
                to = $Phone
                type = "text"
                text = @{
                    preview_url = $true
                    body = $diagText
                }
            } | ConvertTo-Json -Depth 10 -Compress
            $metaUrl = "https://graph.facebook.com/$waGraph/$waPhoneId/messages"
            $metaResp = Invoke-JsonHttp -Url $metaUrl -Method "Post" -Headers @{ Authorization = "Bearer $waToken"; "Content-Type" = "application/json" } -Body $metaPayload -TimeoutSeconds 30
            Add-Log "Meta sender normal: HTTP=$($metaResp.Status) ms=$($metaResp.Ms)"
            if ($metaResp.Ok -and $null -ne $metaResp.Json -and @($metaResp.Json.messages).Count -gt 0) {
                $MetaAccepted = $true
                $mid = [string]$metaResp.Json.messages[0].id
                Add-Log "Meta aceptó mensaje. message_id=$(Mask-Id $mid)"
                $statusFound = $false
                $statusLogs = ""
                for ($attempt = 1; $attempt -le 6; $attempt += 1) {
                    Start-Sleep -Seconds 3
                    $logs = Run-Netlify @("logs", "--source", "functions", "--function", "cartes-whatsapp", "--since", "5m")
                    $statusLogs = $logs.Out
                    if ($statusLogs -match [regex]::Escape($mid)) {
                        $statusFound = $true
                        break
                    }
                }
                Add-Log "Consulta de logs para status Meta exit code: $($logs.Code)"
                if ($statusFound) {
                    $statusLines = @($statusLogs -split "`r?`n" | Where-Object { $_ -match [regex]::Escape($mid) -or $_ -match 'WHATSAPP_STATUS_JSON|ESTADO WHATSAPP' } | Select-Object -Last 30)
                    foreach ($line in $statusLines) { Add-Log ("META_STATUS_LOG: " + $line.Trim()) }
                } else {
                    Add-Log "No apareció el message_id en logs tras hasta 18 segundos. Aceptación HTTP de Meta sí fue confirmada."
                }
            } else {
                Add-Log "Meta rechazó/no aceptó sender normal: $(Short-Error ($metaResp.Error + ' ' + $metaResp.Raw))"
            }
        }

        Add-Section "12. REPRODUCCIÓN CONTROLADA DEL HANDLER REAL cartes-whatsapp"
        $metaAppSecret = Get-NetlifyEnvValue "META_APP_SECRET"
        if (-not $metaAppSecret) {
            Add-Log "META_APP_SECRET no fue legible por CLI. No se puede firmar una reproducción directa del webhook."
        } elseif (-not $AccountStateOk -or $null -eq $CurrentUsage) {
            Add-Log "Reproducción del handler omitida porque no se pudo confirmar el estado real de cuenta."
        } elseif ([int]$CurrentUsage.disponibles -lt 3) {
            Add-Log "Reproducción del handler omitida para preservar al menos 2 consultas disponibles del usuario."
        } else {
            $HandlerProbeRun = $true
            $beforeUsed = [int]$CurrentUsage.usadas
            $diagMessageId = "diagprod-$RunId"
            $diagTimestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
            $webhookPayloadObj = @{
                object = "whatsapp_business_account"
                entry = @(
                    @{
                        id = "diagnostic"
                        changes = @(
                            @{
                                field = "messages"
                                value = @{
                                    messaging_product = "whatsapp"
                                    messages = @(
                                        @{
                                            from = $Phone
                                            id = $diagMessageId
                                            timestamp = $diagTimestamp
                                            type = "text"
                                            text = @{ body = $QuestionAI }
                                        }
                                    )
                                }
                            }
                        )
                    }
                )
            }
            $webhookRaw = $webhookPayloadObj | ConvertTo-Json -Depth 15 -Compress
            $webhookSig = Hmac-Hex $metaAppSecret $webhookRaw
            $handlerUrl = "$BaseUrl/.netlify/functions/cartes-whatsapp"
            Add-Log "Se invoca el handler real con message_id sintético=$(Mask-Id $diagMessageId), teléfono real y la misma pregunta IA."
            Add-Log "Si la consulta completa con éxito, consumirá 1 consulta real. Si falla dentro del bloque de consulta, el código intenta liberarla."
            $handlerResp = Invoke-JsonHttp -Url $handlerUrl -Method "Post" -Headers @{
                "X-Hub-Signature-256" = "sha256=$webhookSig"
                "Content-Type" = "application/json"
            } -Body $webhookRaw -TimeoutSeconds 58
            Add-Log "Handler cartes-whatsapp: HTTP=$($handlerResp.Status) ms=$($handlerResp.Ms)"
            if ($handlerResp.Ok -and $null -ne $handlerResp.Json) {
                Add-Log "Handler respuesta: recibido=$($handlerResp.Json.recibido) mensajes=$($handlerResp.Json.mensajes) estados=$($handlerResp.Json.estados) duplicados=$($handlerResp.Json.mensajesDuplicados) enviadas=$($handlerResp.Json.respuestasEnviadas) fallidas=$($handlerResp.Json.respuestasFallidas)"
                if ([int]$handlerResp.Json.respuestasFallidas -gt 0) {
                    $HandlerProbeFailed = $true
                } elseif ([int]$handlerResp.Json.respuestasEnviadas -gt 0) {
                    $HandlerProbeOk = $true
                }
            } else {
                Add-Log "Handler error HTTP: $(Short-Error ($handlerResp.Error + ' ' + $handlerResp.Raw))"
                $HandlerProbeFailed = $true
            }

            Start-Sleep -Seconds 2
            $handlerLogs = Run-Netlify @("logs", "--source", "functions", "--function", "cartes-whatsapp", "--since", "5m")
            Add-Log "Logs del handler exit code: $($handlerLogs.Code)"
            $handlerInteresting = @($handlerLogs.Out -split "`r?`n" | Where-Object {
                $_ -match [regex]::Escape($diagMessageId) -or
                $_ -match 'No se pudo responder el mensaje entrante|Respuesta obtenida de Cartes Core|Webhook válido procesado|WhatsApp respondió con HTTP|No se pudo liberar una consulta fallida'
            } | Select-Object -Last 50)
            if ($handlerInteresting.Count -gt 0) {
                $HandlerProbeLogFound = $true
                foreach ($line in $handlerInteresting) { Add-Log ("HANDLER_LOG: " + $line.Trim()) }
            } else {
                Add-Log "No se encontraron líneas internas correlacionables en los logs disponibles."
            }

            if ($internalSecret) {
                $afterState = Invoke-Account @{ action = "state"; user_id = $UserId; plan = $null } $internalSecret "$BaseUrl/.netlify/functions/cartes-account"
                if ($afterState.Ok -and $null -ne $afterState.Json) {
                    $afterUsed = [int]$afterState.Json.usadas
                    Add-Log "Uso antes=$beforeUsed después=$afterUsed delta=$($afterUsed - $beforeUsed)"
                    if ($HandlerProbeFailed -and $afterUsed -gt $beforeUsed) {
                        Add-Log "ALERTA: el handler falló pero el uso aumentó. Revisar liberación/estado pendiente."
                    }
                }
            }
        }

        Add-Section "13. COBERTURA DE PRUEBAS DEL CAMINO NORMAL WHATSAPP"
        $coverageNormal = $false
        $testFiles = Get-ChildItem -Path "tests\whatsapp" -Filter "*.test.mjs" -File -ErrorAction SilentlyContinue
        foreach ($tf in $testFiles) {
            $txt = Get-Content -LiteralPath $tf.FullName -Raw
            if ($txt -match 'procesarConsultaCartesConLimite' -or ($txt -match 'cartes-whatsapp' -and $txt -match 'consultarCartesCore')) {
                $coverageNormal = $true
                Add-Log "Prueba candidata de ruta normal: $($tf.Name)"
            }
        }
        Add-Log "Se detectó test explícito de extremo a extremo del handler para una consulta textual normal: $coverageNormal"
        if (-not $coverageNormal) {
            Add-Log "GAP: hay tests del cliente Core y de enviarTextoEnPartes, pero no se detectó una prueba que atraviese handler -> identidad -> reserva -> Core -> sender normal para una consulta textual real."
        }

        Add-Section "14. DIAGNÓSTICO AUTOMÁTICO"
        Add-Log "IDENTIDAD_CENTRAL=$IdentityOk"
        Add-Log "ACCOUNT_STATE_REAL=$AccountStateOk"
        Add-Log "RESERVE_RELEASE_REAL=$ReserveReleaseOk"
        Add-Log "CORE_DIRECT=$CoreDirectOk"
        Add-Log "CORE_AI_BASE=$CoreAiOk"
        Add-Log "CORE_AI_USER_HISTORY=$CoreHistoryOk"
        Add-Log "META_SENDER_NORMAL_ACCEPTED=$MetaAccepted"
        Add-Log "HANDLER_PROBE_RUN=$HandlerProbeRun"
        Add-Log "HANDLER_PROBE_OK=$HandlerProbeOk"
        Add-Log "HANDLER_PROBE_FAILED=$HandlerProbeFailed"
        Add-Log "HANDLER_PROBE_LOG_FOUND=$HandlerProbeLogFound"
        Add-Log "WEB_IDENTITIES_ON_SAME_USER=$WebIdentityCount"

        if (-not $IdentityOk) {
            Add-Log "CAUSA MÁS PROBABLE: identidad WhatsApp central ausente/corrupta."
        } elseif (-not $AccountStateOk) {
            Add-Log "CAUSA MÁS PROBABLE: Cartes Account/HMAC/estado del usuario real."
        } elseif (-not $ReserveReleaseOk -and $null -ne $CurrentUsage -and [int]$CurrentUsage.disponibles -gt 1) {
            Add-Log "CAUSA MÁS PROBABLE: reserva/liberación central de consultas para este user_id."
        } elseif (-not $CoreAiOk) {
            Add-Log "CAUSA MÁS PROBABLE: Core/OpenAI en la ruta IA."
        } elseif ($CoreAiOk -and -not $CoreHistoryOk) {
            Add-Log "CAUSA MÁS PROBABLE: historial/contexto compartido del usuario al entrar desde WhatsApp."
        } elseif ($CoreHistoryOk -and -not $MetaAccepted) {
            Add-Log "CAUSA MÁS PROBABLE: sender normal de WhatsApp hacia Meta, payload o credenciales efectivas del canal."
        } elseif ($HandlerProbeRun -and $HandlerProbeFailed) {
            Add-Log "CAUSA AISLADA AL HANDLER REAL: los componentes probados por separado funcionan, pero cartes-whatsapp falla al orquestarlos."
            if ($HandlerProbeLogFound) {
                Add-Log "Usar las líneas HANDLER_LOG de este reporte como fuente primaria para la corrección mínima."
            } else {
                Add-Log "Los logs no exponen la excepción. El siguiente paso es instrumentación temporal por etapas o comparación del bundle desplegado, sin tocar Core ni pagos."
            }
        } elseif ($HandlerProbeRun -and $HandlerProbeOk) {
            Add-Log "EL HANDLER REAL PASÓ EN LA REPRODUCCIÓN CONTROLADA."
            Add-Log "El defecto original no se reprodujo con el estado actual. Revisar deriva temporal de deploy, historial previo, variables por contexto o intermitencia externa, usando timestamps y message_id."
        } elseif ($CoreHistoryOk -and $MetaAccepted -and $AccountStateOk -and ($ReserveReleaseOk -or ([int]$CurrentUsage.disponibles -le 1))) {
            Add-Log "TODOS LOS COMPONENTES EXTERNOS PRINCIPALES PASARON."
            Add-Log "Foco restante: orquestación exacta/deploy real de cartes-whatsapp o deriva entre el código local y el bundle desplegado."
            Add-Log "En ese caso no corresponde tocar Core, OpenAI, Meta ni pagos; corresponde instrumentar el handler por etapas o comparar el deploy efectivo."
        }

        if ($WebIdentityCount -eq 0) {
            Add-Log "OBSERVACIÓN: Web y WhatsApp NO aparecen vinculados al mismo user_id en el registro central leído. Esto puede explicar diferencias de estado/uso entre interfaces, aunque no explica por sí solo un fallback general."
        } else {
            Add-Log "OBSERVACIÓN: Web y WhatsApp sí comparten el mismo user_id central según el registro leído."
        }

        Add-Log ""
        Add-Log "Fin: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')"
    }
    catch {
        Add-Section "DIAGNÓSTICO DETENIDO"
        Add-Log "TYPE: $($_.Exception.GetType().FullName)"
        Add-Log "MESSAGE: $($_.Exception.Message)"
        Add-Log "No se hizo deploy ni se modificaron variables, pagos o suscripciones."
    }

    Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
}
