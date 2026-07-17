extends Control

@onready var chat_display = $VBoxContainer/ScrollContainer/ChatDisplay
@onready var input_field = $VBoxContainer/HBoxContainer/LineEdit
@onready var send_button = $VBoxContainer/HBoxContainer/SendButton
@onready var api_client = $APIClient

var current_session_id: int = -1

func _ready():
    send_button.pressed.connect(_on_send_pressed)
    api_client.chat_received.connect(_on_api_response)
    api_client.start_scenario("cyberbully_01", "medium")

func _on_send_pressed():
    var text = input_field.text.strip_edges()
    if text.is_empty():
        return
        
    add_message("You", text)
    input_field.text = ""
    
    if current_session_id != -1:
        api_client.send_message(current_session_id, text)

func _on_api_response(data: Dictionary):
    if data.has("session_id"):
        current_session_id = data["session_id"]
        if data.has("initial_message"):
            add_message("AI", data["initial_message"])
    elif data.has("reply"):
        add_message("AI", data["reply"])
        update_meters(data.get("risk_score", 0.0))

func add_message(sender: String, text: String):
    var label = RichTextLabel.new()
    label.text = "[b]" + sender + ":[/b] " + text
    label.fit_content = true
    chat_display.add_child(label)

func update_meters(risk: float):
    pass
