"""
StorageService

현재: 로컬 파일 시스템
추후: AWS S3로 교체 가능

교체 포인트:
1. upload_file() - boto3 S3 SDK 사용
2. delete_file() - boto3 S3 SDK 사용
"""

import os
import uuid
import aiofiles
from pathlib import Path
from typing import Tuple


class StorageService:
    def __init__(self):
        self.upload_dir = Path("app/uploads")
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    async def upload_file(
        self,
        file_content: bytes,
        original_filename: str,
        resident_id: str
    ) -> Tuple[str, str]:
        """
        파일 업로드 (로컬)
        
        S3 교체 시:
        - boto3로 S3 업로드
        - public URL 반환
        """
        try:
            # 고유 파일명 생성
            ext = original_filename.split(".")[-1] if "." in original_filename else "jpg"
            file_name = f"{resident_id}_{uuid.uuid4().hex}.{ext}"
            
            file_path = self.upload_dir / file_name
            
            # 파일 저장
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(file_content)
            
            # URL 생성 (상대 경로)
            file_url = f"/uploads/{file_name}"
            
            return file_name, file_url
            
            """
            S3 교체 예시:
            
            import boto3
            
            s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION")
            )
            
            bucket_name = os.getenv("S3_BUCKET_NAME")
            key = f"photos/{resident_id}/{file_name}"
            
            s3_client.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=file_content,
                ContentType=f"image/{ext}",
                ACL='public-read'
            )
            
            file_url = f"https://{bucket_name}.s3.amazonaws.com/{key}"
            return file_name, file_url
            """
        
        except Exception as e:
            raise Exception(f"File upload failed: {str(e)}")
    
    async def delete_file(self, file_url: str) -> None:
        """
        파일 삭제 (로컬)
        
        S3 교체 시:
        - boto3로 S3 삭제
        """
        try:
            file_name = file_url.split("/")[-1]
            file_path = self.upload_dir / file_name
            
            if file_path.exists():
                file_path.unlink()
            
            """
            S3 교체 예시:
            
            import boto3
            
            s3_client = boto3.client('s3', ...)
            bucket_name = os.getenv("S3_BUCKET_NAME")
            key = file_url.replace(f"https://{bucket_name}.s3.amazonaws.com/", "")
            
            s3_client.delete_object(Bucket=bucket_name, Key=key)
            """
        
        except Exception as e:
            raise Exception(f"File delete failed: {str(e)}")