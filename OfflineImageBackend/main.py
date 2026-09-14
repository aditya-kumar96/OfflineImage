from fastapi import FastAPI, UploadFile, File, Form, status, HTTPException 
from fastapi.staticfiles import StaticFiles
from fastapi import Request
import os
import shutil
import uuid

app = FastAPI()
Upload_folder = "uploads"
os.makedirs(Upload_folder, exist_ok=True)

app.mount("/uploads",StaticFiles(directory=Upload_folder),name="uploads")


@app.get("/")
def home():
    return {"message": "Offline Image upload API is running..."}


@app.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_image(photo: UploadFile = File(...), photoId: str = Form(...)):
    file_extension = os.path.splitext(photo.filename)[1]
    file_name = f"{photoId}{file_extension}"
    file_path = os.path.join(Upload_folder, file_name)
    if os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Photo already uploaded",
        )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)

    return {
        "success": True,
        "alreadyUploaded": False,
        "message": "Photo uploaded successfully",
        "fileName": file_name,
    }


@app.get("/images")
def get_images(request:Request):
    images=[]
    for file in os.listdir(Upload_folder):
        file_path = os.path.join(
            Upload_folder,
            file
        )
        if os.path.isfile(file_path):
            print("is file ?")
            images.append({
                "filename":file,
                "url": str( request.base_url ) + f"uploads/{file}"
            })
    return {
        "images":images
    }