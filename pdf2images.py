#!/usr/bin/env python
# coding=utf-8

import os
import argparse
from pdf2image import convert_from_path

def convert_pdf_to_images(pdf_path, output_folder):
    # 调用convert_from_path函数将PDF转换为图像
    images = convert_from_path(pdf_path)

    # 创建图像输出文件夹
    os.makedirs(output_folder, exist_ok=True)

    # 保存每个图像到输出文件夹
    for i, image in enumerate(images):
        image_path = os.path.join(output_folder, f'page_{i + 1}.jpg')
        image.save(image_path, 'JPEG')

        print('保存图像：', image_path)

if __name__ == '__main__':
    # 创建解析器对象
    parser = argparse.ArgumentParser(description='Convert PDF to images')

    # 添加参数
    parser.add_argument('pdf', help='PDF file path')
    parser.add_argument('output', help='output folder path')

    # 解析命令行参数
    args = parser.parse_args()

    # 调用函数将PDF转换为图像
    convert_pdf_to_images(args.pdf, args.output)

