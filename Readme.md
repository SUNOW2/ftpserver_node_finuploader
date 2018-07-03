# 简介

本项目主要用于存储大文件和小文件，整合了FineUploader的后端实现，并将用户上传的文件存入FtpServer服务器，将文件相关信息存入mysql数据库。

## 启动
iptables -t nat -A DOCKER -p tcp --dport 3001 -j DNAT --to-destination 172.17.0.3:3001
iptables -t nat -A DOCKER -p tcp --dport 3002 -j DNAT --to-destination 172.17.0.3:80

## package.json介绍

name：包的名字

version：包的版本号

description：包的描述

homepage：包的网站主页

author：包的作者

contributors：包的贡献者的名称列表

dependencies：依赖性列表

repository：包的存储库和URL

main：包的入口点

keywords：关键字





