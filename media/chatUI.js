const vscode_api = acquireVsCodeApi();
const md = new markdownit();

function addMessageToUI(role, content) {
    // Create a MarkdownIt instance for rendering markdown content
    const messagesContainer = document.getElementById('messages-container');

    // Create a container for the message item
    const messageItem = document.createElement('div');
    messageItem.classList.add('message-item');
  
    // Create a sender icon element and add the appropriate class based on the role (user or bot)
    const senderIcon = document.createElement('i');
    const iconClasses = role === 'user' ? ['fas', 'fa-user-circle'] : ['fas', 'fa-robot'];
    senderIcon.classList.add(...iconClasses);
  
    // Create a container for the message content
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
  
    // Render the markdown content inside the message content container
    const renderedContent = md.render(content);
    messageContent.innerHTML = renderedContent;
  
    // Find any code blocks in the rendered content and add a class to style them
    const codeBlocks = messageContent.querySelectorAll('pre > code');
    codeBlocks.forEach(block => {
    block.classList.add('code-block');
    });
    initClipboard(codeBlocks);

    messageItem.appendChild(senderIcon);
    messageItem.appendChild(messageContent);

    // Create an action icon element (checkmark)
    if (role === 'user') {
        const editButton = document.createElement('button');
        editButton.classList.add('edit-button');
        editButton.innerHTML = '<i class="fas fa-edit"></i>';
        messageItem.appendChild(editButton);

        // Add a click listener to the edit button
        editButton.addEventListener('click', () => {
            // Hide the edit button
            editButton.style.display = 'none';
        
            // Create a new text area element with the same size as the message content
            const textArea = document.createElement('textarea');
            textArea.classList.add('edit-textarea');
            textArea.style.width = `${messageContent.offsetWidth}px`;
            textArea.style.height = `${messageContent.offsetHeight}px`;
            textArea.value = messageContent.textContent.trim();
            messageContent.replaceWith(textArea);
        
            // Create a save button element and add it after the text area
            const saveButton = document.createElement('button');
            saveButton.classList.add('save-button');
            saveButton.innerText = 'Save';
            textArea.parentNode.insertBefore(saveButton, textArea.nextSibling);
        
            // Create a cancel button element and add it before the text area
            const cancelButton = document.createElement('button');
            cancelButton.classList.add('cancel-button');
            cancelButton.innerText = 'Cancel';
            textArea.parentNode.insertBefore(cancelButton, textArea.nextSibling);
        
            // Add an event listener for the cancel button
            cancelButton.addEventListener('click', () => {
                textArea.replaceWith(messageContent)
              // Remove the text area, save button, and cancel button
              textArea.remove();
              saveButton.remove();
              cancelButton.remove();
        
              // Show the edit button
              editButton.style.display = 'inline-block';
            });
        
            // Add an event listener for the save button
            saveButton.addEventListener('click', () => {
              const newMessage = textArea.value.trim();
              if (newMessage !== '') {
                textArea.replaceWith(messageContent)
                // Remove the text area, save button, and cancel button
                textArea.remove();
                saveButton.remove();
                cancelButton.remove();
        
                // Show the edit button
                editButton.style.display = 'inline-block';
        
                // Process and send the new message to the extension
                processMessageUI(newMessage);
              }
            });
        
            // Focus on the text area
            textArea.focus();
        });
    } else {
        const actionIcon = document.createElement('i');
        actionIcon.className = 'fas fa-check-circle';
        messageItem.appendChild(actionIcon);
    }

    messagesContainer.appendChild(messageItem);

    // Scroll the messages container to the bottom to display the latest message
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Function to process the user's message and send it to the extension
function processMessage(message) {
    // Send the message to the extension
    vscode_api.postMessage({
      command: 'sendMessage',
      text: message
    });
}

function processMessageUI(message) {
    addMessageToUI('user', message);
    processMessage(message);
}