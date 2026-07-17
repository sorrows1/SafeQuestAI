extends Node
class_name APIClient

signal request_completed(result, response_code, headers, body)
signal chat_received(response_data)

const BASE_URL = "http://localhost:8000"
var http_request: HTTPRequest

func _ready():
    http_request = HTTPRequest.new()
    add_child(http_request)
    http_request.request_completed.connect(_on_request_completed)

func start_scenario(scenario_id: String, difficulty: String):
    var url = BASE_URL + "/scenario/start"
    var body = JSON.stringify({"scenario_id": scenario_id, "difficulty": difficulty})
    var headers = ["Content-Type: application/json"]
    http_request.request(url, headers, HTTPClient.METHOD_POST, body)

func send_message(session_id: int, message: String):
    var url = BASE_URL + "/chat"
    var body = JSON.stringify({"session_id": session_id, "message": message})
    var headers = ["Content-Type: application/json"]
    http_request.request(url, headers, HTTPClient.METHOD_POST, body)

func _on_request_completed(result: int, response_code: int, headers: PackedStringArray, body: PackedByteArray):
    if response_code == 200:
        var json = JSON.new()
        var error = json.parse(body.get_string_from_utf8())
        if error == OK:
            chat_received.emit(json.data)
