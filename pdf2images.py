#!/usr/bin/env python
# coding=utf-8

import os
import sys
from PIL import Image
from pdf2image import convert_from_path

def main(input_pdf, output_folder):
    # 1. 使用 pdf2image 库将 PDF 转换为图片
    images = convert_from_path(input_pdf)

    # 2. 使用 PIL 库将图片压缩并保存到输出文件夹
    for i, img in enumerate(images):
        img.thumbnail((1024, 1024))  # 可以根据需要修改这个大小
        img.save(os.path.join(output_folder, f'image_{i}.jpg'), format='JPEG', quality=60)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python script.py [input_pdf] [output_folder]")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])

