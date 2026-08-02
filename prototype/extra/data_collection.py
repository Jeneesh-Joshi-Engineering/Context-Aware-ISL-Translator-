import cv2
import numpy as np

print("Attempting to open camera...")

cap = cv2.VideoCapture(0)

# Set timeout for camera capture
cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

# Check if camera opened successfully
if not cap.isOpened():
    print("ERROR: Could not open camera. Please check if:")
    print("  - Camera is connected")
    print("  - Camera is not in use by another application")
    print("  - You have permission to access the camera")
    exit(1)

print("Camera opened successfully!")
print("Camera is turning on... Press 'q' on your keyboard to quit.")
print("Note: This uses a basic OpenCV hand detector.")

while True:
    success, frame = cap.read()

    if not success:
        print("Failed to grab frame")
        break

    # Get frame dimensions
    h, w = frame.shape[:2]
    
    # Try to find skin-colored regions (basic hand detection)
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    # Define range for skin color in HSV
    lower_skin = np.array([0, 20, 70], dtype=np.uint8)
    upper_skin = np.array([20, 255, 255], dtype=np.uint8)
    
    # Create mask for skin color
    mask = cv2.inRange(hsv, lower_skin, upper_skin)
    
    # Apply morphological operations to clean up the mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        # Find the largest contour (likely the hand)
        hand_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(hand_contour)
        
        if area > 1000:  # Minimum area threshold
            # Draw bounding rectangle
            x, y, w_rect, h_rect = cv2.boundingRect(hand_contour)
            cv2.rectangle(frame, (x, y), (x + w_rect, y + h_rect), (0, 255, 0), 2)
            
            # Draw contour
            cv2.drawContours(frame, [hand_contour], 0, (0, 0, 255), 2)
            
            # Find fingertips using convexity
            hull = cv2.convexHull(hand_contour)
            cv2.drawContours(frame, [hull], 0, (255, 0, 0), 2)
            
            # Get center of hand
            M = cv2.moments(hand_contour)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                cv2.circle(frame, (cx, cy), 5, (255, 255, 0), -1)
                print(f"Hand Center -> X: {cx}, Y: {cy}")

    cv2.imshow("Sign Language Tracker", frame)
    cv2.imshow("Mask", mask)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()