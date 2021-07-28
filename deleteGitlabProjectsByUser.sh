#!/bin/bash

if [ -z "$1" ]; then
    echo "No username given. Exiting."
    exit
fi

homeworks_raw=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "https://gitlab.com/api/v4/projects?search=homework-$1&simple=true&per_page=100")
count=$(echo "$homeworks_raw" | jq length)

echo "Found $count homeworks..."

for i in $(seq 0 $((count-1))); do
	echo "$homeworks_raw" | jq ".[$i].name"
done

delete_projects () {
	for i in $(seq 0 $((count-1))); do
		id=$(echo "$homeworks_raw" | jq ".[$i].id")
		name=$(echo "$homeworks_raw" | jq ".[$i].name")
		echo "Deleting $name with id: $id"
		echo
		curl -X DELETE --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "https://gitlab.com/api/v4/projects/$id"
		echo
   	done
}

if [ "$count" -le 0  ]; then
	exit
fi

read -p "Do you want to delete them? [y/n] " 

echo
if [[ $REPLY =~ ^[Yy]$ ]]

then
	delete_projects
else
	exit
fi

