Attribute VB_Name = "JHVLive"
Option Explicit
' Optional example for Windows PowerPoint. Never save tokens in the document.
Public Sub JHVLiveAktualisieren()
    Dim request As Object, endpoint As String, token As String, slide As Object
    endpoint = Environ$("PDT_JHV_API_URL")
    token = Environ$("PDT_JHV_ID_TOKEN")
    If Len(endpoint) = 0 Or Len(token) = 0 Then
        MsgBox "API-Adresse und kurzlebiges Firebase-ID-Token fehlen.", vbExclamation
        Exit Sub
    End If
    If Left$(endpoint, 8) <> "https://" Then
        MsgBox "Die API muss HTTPS verwenden.", vbExclamation
        Exit Sub
    End If
    On Error GoTo Failed
    Set request = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    request.setTimeouts 5000, 5000, 5000, 10000
    request.Open "GET", endpoint, False
    request.setRequestHeader "Authorization", "Bearer " & token
    request.Send
    If request.Status <> 200 Then
        MsgBox "Livezugriff abgewiesen. Bitte Anmeldung und Leitungsrolle pr?fen.", vbExclamation
        Exit Sub
    End If
    If SlideShowWindows.Count > 0 Then
        Set slide = SlideShowWindows(1).View.Slide
    Else
        Set slide = ActiveWindow.View.Slide
    End If
    slide.Shapes("JHV_LIVE").TextFrame.TextRange.Text = request.responseText
    Exit Sub
Failed:
    MsgBox "Liveaktualisierung fehlgeschlagen. Browseransicht verwenden.", vbExclamation
End Sub
' Use an API URL with assemblyId and format=text. Firebase ID tokens expire.
' No automatic timer is installed by this example.
