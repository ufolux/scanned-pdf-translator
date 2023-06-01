#!/usr/bin/env python
# coding=utf-8

import os
import sys
from io import BytesIO
from PIL import Image
from reportlab.platypus import SimpleDocTemplate, Image as ReportLabImage
from reportlab.lib.pagesizes import letter

def main(input_folder, output_pdf):
    # 1. 列出文件夹中的所有图片并按照创建时间排序
    all_images = [os.path.join(input_folder, img) for img in os.listdir(input_folder) if img.endswith('.png') or img.endswith('.jpg')]

    # 按创建时间排序
    all_images.sort(key=os.path.getctime)

    # 2. 使用PIL压缩图片并保存到内存
    compressed_images = []
    for img_path in all_images:
        img = Image.open(img_path)
        img.thumbnail((1024, 1024))  # 可以根据需要修改这个大小
        byte_arr = BytesIO()
        img.save(byte_arr, format='JPEG', quality=60)  # 使用JPEG格式并设置质量为60进行压缩
        byte_arr.seek(0)
        compressed_images.append(byte_arr)

    # 3. 使用reportlab将图片组合成PDF
    doc = SimpleDocTemplate(output_pdf, pagesize=letter)
    story = [ReportLabImage(img_data, width=500, height=500) for img_data in compressed_images]  # 将所有压缩后的图片添加到PDF文档
    doc.build(story)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py [input_folder] [output_pdf]")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])

